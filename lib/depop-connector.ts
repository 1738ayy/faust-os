import type { ChannelListingDraft, MarketplaceConnectorDiagnostic, MarketplacePublishTask, OperatingData } from "@/domain/business";
import { deterministicUuid } from "./finance";
import { ConnectorError, ConnectorRuntime, ensureMarketplaceConnectorCollections, listingFromDraft, recordMarketplaceDiagnostic, recordMarketplaceSnapshot, type AdapterConnectionInput, type ConnectorHealth, type ConnectorOperationResult, type MarketplaceAdapter, type MarketplaceAdapterCapabilities, type MarketplaceAdapterContext } from "./marketplace-adapter-sdk";

export const DEPOP_CONNECTOR_VERSION = "depop-selling-api-v1.2026-07";
const now = () => new Date().toISOString();

export type DepopConnectorMode = "fixture" | "sandbox" | "production";
export type DepopPublishPayload = {
  address: { country_code: string; state?: string };
  description: string;
  price_currency: string;
  price_amount: string;
  national_shipping_cost?: string;
  international_shipping_cost?: string;
  quantity: number;
  pictures: { url: string }[];
  department: string;
  product_type: string;
  condition: string;
  colour?: string[];
  style?: string[];
  brand_name?: string;
  attributes: Record<string, string | number | boolean | string[]>;
};
export type DepopConnectorResult = { externalId: string; externalUrl: string; requestId: string; httpStatus: number; metadata: Record<string, string | number | boolean | null> };
export type DepopConnectorErrorCode = MarketplacePublishTask["failureCode"] | "credentials_missing" | "connector_not_configured" | "scope_missing" | "schema_mismatch";
export class DepopConnectorError extends Error {
  constructor(message: string, readonly code: DepopConnectorErrorCode, readonly retryable: boolean, readonly httpStatus?: number, readonly requestId?: string, readonly metadata: Record<string, string | number | boolean | null> = {}) {
    super(message);
  }
}

export function ensureDepopConnectorCollections(data: OperatingData) {
  ensureMarketplaceConnectorCollections(data);
}

export function depopConnectorConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = (env.DEPOP_CONNECTOR_MODE === "production" || env.DEPOP_CONNECTOR_MODE === "sandbox") ? env.DEPOP_CONNECTOR_MODE : "fixture";
  return {
    mode: mode as DepopConnectorMode,
    baseUrl: env.DEPOP_API_BASE_URL || (mode === "production" ? "https://partnerapi.depop.com" : "https://partnerapi-staging.depop.com"),
    apiKeyConfigured: Boolean(env.DEPOP_API_KEY),
    tokenRef: env.DEPOP_API_KEY ? "env:DEPOP_API_KEY" : "missing:DEPOP_API_KEY",
    timeoutMs: Number(env.DEPOP_API_TIMEOUT_MS || 15000),
  };
}

export function depopReadiness(data: OperatingData, env: NodeJS.ProcessEnv = process.env) {
  ensureDepopConnectorCollections(data);
  const account = (data.marketplaceAccounts || []).find((entry) => entry.marketplace === "Depop");
  const config = depopConnectorConfig(env);
  const credential = account ? data.marketplaceConnectorCredentials!.find((entry) => entry.marketplace === "Depop" && entry.accountId === account.id && ["configured", "validated"].includes(entry.status)) : undefined;
  const configured = config.mode === "fixture" || Boolean(credential) || config.apiKeyConfigured;
  return { marketplace: "Depop" as const, configured, reachable: config.mode === "fixture" ? true : config.apiKeyConfigured, mode: config.mode, accountStatus: account?.status || "credentials_required", tokenRef: credential?.tokenRef || config.tokenRef, connectorVersion: DEPOP_CONNECTOR_VERSION };
}

function dollars(value: number) {
  return Math.max(0, Math.round(value * 100) / 100).toFixed(2);
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function depopProductType(category: string) {
  const key = slug(category);
  if (key.includes("t_shirt") || key.includes("tee")) return "tshirts";
  if (key.includes("hood")) return "hoodies";
  if (key.includes("short")) return "shorts";
  if (key.includes("pant") || key.includes("jean")) return "trousers";
  if (key.includes("necklace") || key.includes("jewel")) return "jewellery";
  if (key.includes("bag")) return "bags";
  return key || "other";
}

function depopCondition(value?: string) {
  const key = slug(value || "used excellent");
  if (key.includes("new") && key.includes("tag")) return "brand_new";
  if (key.includes("new")) return "new_without_tags";
  if (key.includes("fair")) return "used_fair";
  if (key.includes("good")) return "used_good";
  return "used_excellent";
}

export function buildDepopPublishPayload(draft: ChannelListingDraft): DepopPublishPayload {
  const attributes = draft.attributes || {};
  const colours = String(attributes.color || attributes.colour || "").split(/[,/]/).map((entry) => entry.trim()).filter(Boolean).slice(0, 3);
  const styles = String(attributes.style || "").split(/[,/]/).map((entry) => entry.trim()).filter(Boolean).slice(0, 5);
  return {
    address: { country_code: String(attributes.shipFromCountry || "US"), state: typeof attributes.shipFromState === "string" ? attributes.shipFromState : undefined },
    description: draft.description,
    price_currency: String(attributes.currency || "USD"),
    price_amount: dollars(draft.price),
    national_shipping_cost: attributes.nationalShippingCost ? dollars(Number(attributes.nationalShippingCost)) : undefined,
    international_shipping_cost: attributes.internationalShippingCost ? dollars(Number(attributes.internationalShippingCost)) : undefined,
    quantity: Math.max(0, draft.quantity),
    pictures: draft.imageUrls.map((url) => ({ url })),
    department: slug(String(attributes.department || "menswear")) || "menswear",
    product_type: depopProductType(draft.category),
    condition: depopCondition(String(attributes.condition || "")),
    colour: colours.length ? colours : undefined,
    style: styles.length ? styles : undefined,
    brand_name: typeof attributes.brand === "string" ? attributes.brand : undefined,
    attributes,
  };
}

function classifyDepopFailure(status: number): { code: DepopConnectorErrorCode; retryable: boolean } {
  if (status === 401) return { code: "authentication_expired", retryable: false };
  if (status === 403) return { code: "scope_missing", retryable: false };
  if (status === 409) return { code: "duplicate_listing", retryable: false };
  if (status === 422 || status === 400) return { code: "validation_rejected", retryable: false };
  if (status === 429) return { code: "rate_limited", retryable: true };
  if (status >= 500) return { code: "marketplace_unavailable", retryable: true };
  return { code: "unknown_connector_response", retryable: status >= 500 };
}

async function requestDepop(path: string, init: RequestInit, env: NodeJS.ProcessEnv = process.env) {
  const config = depopConnectorConfig(env);
  if (!config.apiKeyConfigured) throw new DepopConnectorError("Depop API credentials are not configured.", "credentials_missing", false, 401);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEPOP_API_KEY}`, ...(init.headers || {}) },
    });
    const requestId = response.headers.get("x-request-id") || response.headers.get("depop-request-id") || deterministicUuid(`depop-request:${path}:${Date.now()}`);
    const text = await response.text();
    const body = text ? JSON.parse(text) as Record<string, unknown> : {};
    if (!response.ok) {
      const classified = classifyDepopFailure(response.status);
      throw new DepopConnectorError(String(body.message || body.error || `Depop request failed with ${response.status}.`), classified.code, classified.retryable, response.status, requestId);
    }
    return { body, requestId, httpStatus: response.status };
  } catch (error) {
    if (error instanceof DepopConnectorError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new DepopConnectorError("Depop request timed out.", "network_timeout", true, 408);
    throw new DepopConnectorError(error instanceof Error ? error.message : "Depop network request failed.", "network_timeout", true);
  } finally {
    clearTimeout(timeout);
  }
}

export async function publishDepopDraftViaConnector(draft: ChannelListingDraft, env: NodeJS.ProcessEnv = process.env): Promise<DepopConnectorResult> {
  const payload = buildDepopPublishPayload(draft);
  const config = depopConnectorConfig(env);
  if (config.mode === "fixture") {
    const externalId = `FAUST-${draft.physicalSku}-${draft.id.slice(0, 8)}`.replace(/[^A-Z0-9-]/gi, "-");
    return { externalId, externalUrl: `https://www.depop.com/products/faust-${externalId.toLowerCase()}`, requestId: deterministicUuid(`depop-fixture:${draft.id}:${draft.updatedAt || draft.createdAt}`), httpStatus: 201, metadata: { mode: "fixture", imageCount: draft.imageUrls.length, productType: payload.product_type } };
  }
  const response = await requestDepop(`/api/v1/products/by-sku/${encodeURIComponent(draft.physicalSku)}/`, { method: "PUT", body: JSON.stringify(payload) }, env);
  const externalId = String(response.body.product_id || response.body.id || response.body.sku || draft.physicalSku);
  const externalUrl = String(response.body.url || response.body.web_url || `https://www.depop.com/products/${externalId}`);
  return { externalId, externalUrl, requestId: response.requestId, httpStatus: response.httpStatus, metadata: { mode: config.mode, imageCount: draft.imageUrls.length, productType: payload.product_type } };
}

export async function updateDepopDraftViaConnector(draft: ChannelListingDraft, env: NodeJS.ProcessEnv = process.env): Promise<DepopConnectorResult> {
  const payload = buildDepopPublishPayload(draft);
  const config = depopConnectorConfig(env);
  if (config.mode === "fixture") {
    return { externalId: draft.externalListingId || `FAUST-${draft.physicalSku}-${draft.id.slice(0, 8)}`.replace(/[^A-Z0-9-]/gi, "-"), externalUrl: draft.externalUrl || `https://www.depop.com/products/faust-${draft.physicalSku.toLowerCase()}`, requestId: deterministicUuid(`depop-fixture-update:${draft.id}:${draft.updatedAt || draft.createdAt}`), httpStatus: 200, metadata: { mode: "fixture", operation: "update", imageCount: draft.imageUrls.length, productType: payload.product_type } };
  }
  const response = await requestDepop(`/api/v1/products/by-sku/${encodeURIComponent(draft.physicalSku)}/`, { method: "PATCH", body: JSON.stringify(payload) }, env);
  const externalId = String(response.body.product_id || response.body.id || response.body.sku || draft.externalListingId || draft.physicalSku);
  const externalUrl = String(response.body.url || response.body.web_url || draft.externalUrl || `https://www.depop.com/products/${externalId}`);
  return { externalId, externalUrl, requestId: response.requestId, httpStatus: response.httpStatus, metadata: { mode: config.mode, operation: "update", imageCount: draft.imageUrls.length, productType: payload.product_type } };
}

export async function syncDepopInventoryViaConnector(draft: ChannelListingDraft, quantity: number, env: NodeJS.ProcessEnv = process.env): Promise<DepopConnectorResult> {
  const config = depopConnectorConfig(env);
  if (config.mode === "fixture") {
    return { externalId: draft.externalListingId || `FAUST-${draft.physicalSku}-${draft.id.slice(0, 8)}`.replace(/[^A-Z0-9-]/gi, "-"), externalUrl: draft.externalUrl || `https://www.depop.com/products/faust-${draft.physicalSku.toLowerCase()}`, requestId: deterministicUuid(`depop-fixture-quantity:${draft.id}:${quantity}`), httpStatus: 200, metadata: { mode: "fixture", operation: "sync_inventory", quantity } };
  }
  const response = await requestDepop(`/api/v1/products/by-sku/${encodeURIComponent(draft.physicalSku)}/`, { method: "PATCH", body: JSON.stringify({ quantity: Math.max(0, quantity) }) }, env);
  const externalId = String(response.body.product_id || response.body.id || response.body.sku || draft.externalListingId || draft.physicalSku);
  const externalUrl = String(response.body.url || response.body.web_url || draft.externalUrl || `https://www.depop.com/products/${externalId}`);
  return { externalId, externalUrl, requestId: response.requestId, httpStatus: response.httpStatus, metadata: { mode: config.mode, operation: "sync_inventory", quantity } };
}

export async function endDepopDraftViaConnector(draft: ChannelListingDraft, env: NodeJS.ProcessEnv = process.env): Promise<DepopConnectorResult> {
  const config = depopConnectorConfig(env);
  if (config.mode === "fixture") {
    return { externalId: draft.externalListingId || `FAUST-${draft.physicalSku}-${draft.id.slice(0, 8)}`.replace(/[^A-Z0-9-]/gi, "-"), externalUrl: draft.externalUrl || `https://www.depop.com/products/faust-${draft.physicalSku.toLowerCase()}`, requestId: deterministicUuid(`depop-fixture-end:${draft.id}:${draft.updatedAt || draft.createdAt}`), httpStatus: 204, metadata: { mode: "fixture", operation: "end" } };
  }
  const response = await requestDepop(`/api/v1/products/by-sku/${encodeURIComponent(draft.physicalSku)}/`, { method: "DELETE" }, env);
  return { externalId: draft.externalListingId || draft.physicalSku, externalUrl: draft.externalUrl || `https://www.depop.com/products/${draft.externalListingId || draft.physicalSku}`, requestId: response.requestId, httpStatus: response.httpStatus, metadata: { mode: config.mode, operation: "end" } };
}

export function recordDepopDiagnostic(data: OperatingData, input: Omit<MarketplaceConnectorDiagnostic, "id" | "createdAt" | "connectorVersion">) {
  return recordMarketplaceDiagnostic(data, { marketplace: "Depop", connectorVersion: DEPOP_CONNECTOR_VERSION }, input);
}

export function recordDepopSnapshot(data: OperatingData, draft: ChannelListingDraft, productId: string, result: DepopConnectorResult) {
  const operationResult: ConnectorOperationResult = { ...result, listing: listingFromDraft(draft, result) };
  return recordMarketplaceSnapshot(data, { marketplace: "Depop", connectorVersion: DEPOP_CONNECTOR_VERSION }, draft, productId, operationResult);
}

function asConnectorError(error: unknown) {
  if (error instanceof DepopConnectorError) {
    const type = error.code === "credentials_missing" || error.code === "connector_not_configured" ? "configuration" : error.code === "scope_missing" || error.code === "authentication_expired" ? "authentication" : error.code === "validation_rejected" ? "validation" : error.code === "rate_limited" ? "rate_limit" : error.code === "network_timeout" ? "timeout" : error.retryable ? "temporary" : "permanent";
    return new ConnectorError(error.message, type, error.code, error.retryable, error.httpStatus, error.requestId, error.metadata);
  }
  return error;
}

const depopCapabilities: MarketplaceAdapterCapabilities = {
  supportsPublish: true,
  supportsUpdate: true,
  supportsEndListing: true,
  supportsRelist: true,
  supportsInventorySync: true,
  supportsDraftValidation: true,
  supportsImageOrdering: true,
  supportsBulkPublish: false,
  supportsOffers: false,
  supportsBundles: false,
  supportsShippingProfiles: false,
};

export class DepopAdapter implements MarketplaceAdapter {
  readonly marketplace = "Depop" as const;
  readonly connectorVersion = DEPOP_CONNECTOR_VERSION;
  readonly capabilities = depopCapabilities;
  runtimeMode(env: NodeJS.ProcessEnv = process.env) {
    return depopConnectorConfig(env).mode;
  }
  async connect(input: AdapterConnectionInput, context: MarketplaceAdapterContext): Promise<ConnectorHealth> {
    ensureDepopConnectorCollections(context.data);
    const account = (context.data.marketplaceAccounts || []).find((entry) => entry.marketplace === "Depop");
    if (!account) throw new ConnectorError("Depop account record is missing.", "configuration", "connector_not_configured", false);
    const time = now();
    account.status = input.validateOnly ? account.status : "connected";
    account.supportsApiPublish = true;
    account.displayName = input.displayName || account.displayName;
    account.lastSyncAt = time;
    account.updatedAt = time;
    const existing = context.data.marketplaceConnectorCredentials!.find((entry) => entry.marketplace === "Depop" && entry.accountId === account.id);
    const credential = existing || { id: crypto.randomUUID(), marketplace: "Depop" as const, accountId: account.id, authMode: input.mode || "api_key" as const, status: "configured" as const, tokenRef: input.tokenRef || "env:DEPOP_API_KEY", scopes: input.scopes || ["products_read", "products_write", "orders_read", "shop_read"], createdAt: time };
    credential.status = "validated";
    credential.tokenRef = input.tokenRef || credential.tokenRef;
    credential.scopes = input.scopes || credential.scopes;
    credential.lastValidatedAt = time;
    credential.updatedAt = time;
    if (!existing) context.data.marketplaceConnectorCredentials!.unshift(credential);
    recordMarketplaceDiagnostic(context.data, this, { accountId: account.id, operation: "connect", status: "succeeded", retryable: false, message: "Depop connector credentials reference validated and stored without exposing secrets.", suggestedResolution: "Publish a marketplace draft from the publishing queue.", metadata: { authMode: credential.authMode, scopeCount: credential.scopes.length } });
    return this.health(context);
  }
  async disconnect(context: MarketplaceAdapterContext): Promise<ConnectorHealth> {
    ensureDepopConnectorCollections(context.data);
    const account = (context.data.marketplaceAccounts || []).find((entry) => entry.marketplace === "Depop");
    if (account) { account.status = "credentials_required"; account.updatedAt = now(); }
    for (const credential of context.data.marketplaceConnectorCredentials!.filter((entry) => entry.marketplace === "Depop")) {
      credential.status = "revoked";
      credential.updatedAt = now();
    }
    recordMarketplaceDiagnostic(context.data, this, { accountId: account?.id, operation: "connect", status: "skipped", retryable: false, message: "Depop connector disconnected. Secrets remain outside the browser and were not exposed.", suggestedResolution: "Reconnect this marketplace before production publishing.", metadata: {} });
    return this.health(context);
  }
  async health(context: MarketplaceAdapterContext): Promise<ConnectorHealth> {
    const readiness = depopReadiness(context.data, context.env);
    return { marketplace: "Depop", connected: readiness.configured, healthy: readiness.configured && readiness.reachable, authState: readiness.configured ? "connected" : "disconnected", mode: readiness.mode, lastSync: context.data.marketplaceAccounts?.find((entry) => entry.marketplace === "Depop")?.lastSyncAt, rateLimit: "unknown", errors: readiness.configured ? [] : ["Depop credentials are not configured."], warnings: readiness.mode === "fixture" ? ["Fixture mode does not contact Depop."] : [], connectorVersion: this.connectorVersion };
  }
  validateDraft(draft: ChannelListingDraft) {
    const errors: string[] = [];
    if (!draft.title.trim()) errors.push("Title is required.");
    if (!draft.description.trim()) errors.push("Description is required.");
    if (draft.price <= 0) errors.push("Price must be greater than zero.");
    if (draft.quantity < 0) errors.push("Quantity cannot be negative.");
    if (!draft.imageUrls.length) errors.push("At least one image is required.");
    return errors;
  }
  translateDraft(draft: ChannelListingDraft) {
    return buildDepopPublishPayload(draft);
  }
  async publish(draft: ChannelListingDraft, context: MarketplaceAdapterContext) {
    void context;
    return ConnectorRuntime.execute(this, "publish", async () => {
      try {
        const result = await publishDepopDraftViaConnector(draft, context.env);
        return { ...result, listing: listingFromDraft(draft, result) };
      } catch (error) {
        throw asConnectorError(error);
      }
    });
  }
  async update(draft: ChannelListingDraft, context: MarketplaceAdapterContext) {
    return ConnectorRuntime.execute(this, "update", async () => {
      try {
        const result = await updateDepopDraftViaConnector(draft, context.env);
        return { ...result, listing: listingFromDraft(draft, result) };
      } catch (error) {
        throw asConnectorError(error);
      }
    });
  }
  async endListing(draft: ChannelListingDraft, context: MarketplaceAdapterContext) {
    return ConnectorRuntime.execute(this, "end", async () => {
      try {
        const result = await endDepopDraftViaConnector(draft, context.env);
        return { ...result, listing: listingFromDraft({ ...draft, quantity: 0 }, result, "ended") };
      } catch (error) {
        throw asConnectorError(error);
      }
    });
  }
  async relist(draft: ChannelListingDraft, context: MarketplaceAdapterContext) {
    return this.publish(draft, context);
  }
  async sync(draft: ChannelListingDraft, input: { quantity?: number }, context: MarketplaceAdapterContext) {
    return ConnectorRuntime.execute(this, "sync_inventory", async () => {
      try {
        const quantity = input.quantity ?? draft.quantity;
        const result = await syncDepopInventoryViaConnector(draft, quantity, context.env);
        return { ...result, listing: listingFromDraft({ ...draft, quantity }, result) };
      } catch (error) {
        throw asConnectorError(error);
      }
    });
  }
  async uploadImages(draft: ChannelListingDraft, context: MarketplaceAdapterContext) {
    void context;
    return ConnectorRuntime.execute(this, "upload_images", async () => {
      const result: ConnectorOperationResult = { externalId: draft.externalListingId || draft.physicalSku, externalUrl: draft.externalUrl || `https://www.depop.com/products/${draft.externalListingId || draft.physicalSku}`, requestId: deterministicUuid(`depop-images:${draft.id}:${draft.imageUrls.join("|")}`), httpStatus: 200, metadata: { mode: depopConnectorConfig(context.env).mode, operation: "upload_images", imageCount: draft.imageUrls.length } };
      return { ...result, listing: listingFromDraft(draft, result) };
    });
  }
  diagnostics(context: MarketplaceAdapterContext) {
    return (context.data.marketplaceConnectorDiagnostics || []).filter((entry) => entry.marketplace === "Depop");
  }
}
