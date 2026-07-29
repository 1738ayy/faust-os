import type { ChannelListingDraft, MarketplaceConnectorDiagnostic, MarketplaceListingSnapshot, MarketplacePublishTask, OperatingData } from "@/domain/business";
import { deterministicUuid } from "./finance";

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
  data.marketplaceConnectorCredentials ||= [];
  data.marketplaceConnectorDiagnostics ||= [];
  data.marketplaceListingSnapshots ||= [];
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
  ensureDepopConnectorCollections(data);
  const diagnostic: MarketplaceConnectorDiagnostic = { id: deterministicUuid(`depop-diagnostic:${input.operation}:${input.draftId || input.accountId || "global"}:${now()}`), connectorVersion: DEPOP_CONNECTOR_VERSION, createdAt: now(), ...input };
  data.marketplaceConnectorDiagnostics!.unshift(diagnostic);
  return diagnostic;
}

export function recordDepopSnapshot(data: OperatingData, draft: ChannelListingDraft, productId: string, result: DepopConnectorResult) {
  ensureDepopConnectorCollections(data);
  const snapshot: MarketplaceListingSnapshot = { id: deterministicUuid(`depop-snapshot:${draft.id}:${result.externalId}`), marketplace: "Depop", draftId: draft.id, productId, variantId: draft.variantId, externalListingId: result.externalId, externalUrl: result.externalUrl, status: "active", title: draft.title, description: draft.description, price: draft.price, quantity: draft.quantity, category: draft.category, imageUrls: draft.imageUrls, observedAt: now(), source: "publish_response", connectorVersion: DEPOP_CONNECTOR_VERSION, metadata: result.metadata };
  data.marketplaceListingSnapshots = [snapshot, ...data.marketplaceListingSnapshots!.filter((entry) => entry.id !== snapshot.id)];
  return snapshot;
}
