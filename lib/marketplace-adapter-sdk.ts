import type { ChannelListingDraft, Marketplace, MarketplaceConnectorDiagnostic, MarketplaceListingSnapshot, MarketplacePublishTask, OperatingData } from "@/domain/business";
import { deterministicUuid } from "./finance";

export type MarketplaceAdapterOperation = MarketplaceConnectorDiagnostic["operation"] | "relist" | "upload_images";
export type ConnectorErrorType = "authentication" | "authorization" | "validation" | "rate_limit" | "temporary" | "permanent" | "timeout" | "network" | "unavailable" | "duplicate" | "configuration" | "unknown";
export type ConnectorAuthState = "connected" | "expired" | "disconnected" | "invalid" | "refreshing" | "pending";
export type ConnectorMode = "fixture" | "sandbox" | "production";
export type ConnectorMetadata = Record<string, string | number | boolean | null>;

export type MarketplaceAdapterCapabilities = {
  supportsPublish: boolean;
  supportsUpdate: boolean;
  supportsEndListing: boolean;
  supportsRelist: boolean;
  supportsInventorySync: boolean;
  supportsDraftValidation: boolean;
  supportsImageOrdering: boolean;
  supportsBulkPublish: boolean;
  supportsOffers: boolean;
  supportsBundles: boolean;
  supportsShippingProfiles: boolean;
};

export type MarketplaceListing = {
  externalId: string;
  url: string;
  status: MarketplaceListingSnapshot["status"];
  inventory: number;
  price: number;
  currency: string;
  lastSync: string;
  images: string[];
  diagnostics: ConnectorMetadata;
  timestamps: { createdAt?: string; updatedAt?: string; observedAt: string };
};

export type ConnectorOperationResult = {
  externalId: string;
  externalUrl: string;
  requestId: string;
  httpStatus: number;
  listing?: MarketplaceListing;
  metadata: ConnectorMetadata;
};

export type ConnectorHealth = {
  marketplace: Exclude<Marketplace, "Manual">;
  connected: boolean;
  healthy: boolean;
  authState: ConnectorAuthState;
  mode: ConnectorMode;
  lastSync?: string;
  rateLimit?: "healthy" | "limited" | "unknown";
  errors: string[];
  warnings: string[];
  connectorVersion: string;
};

export type MarketplaceAdapterContext = { data: OperatingData; env?: NodeJS.ProcessEnv; task?: MarketplacePublishTask };

export type AdapterConnectionInput = { displayName?: string; tokenRef?: string; scopes?: string[]; mode?: "api_key" | "oauth_pkce"; validateOnly?: boolean };

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly type: ConnectorErrorType,
    readonly failureCode: MarketplacePublishTask["failureCode"] | "credentials_missing" | "connector_not_configured" | "scope_missing" | "schema_mismatch",
    readonly retryable: boolean,
    readonly httpStatus?: number,
    readonly requestId?: string,
    readonly metadata: ConnectorMetadata = {},
    readonly retryDelayMs?: number,
  ) {
    super(message);
  }
}

export interface MarketplaceAdapter {
  readonly marketplace: Exclude<Marketplace, "Manual">;
  readonly connectorVersion: string;
  readonly capabilities: MarketplaceAdapterCapabilities;
  runtimeMode(env?: NodeJS.ProcessEnv): ConnectorMode;
  connect(input: AdapterConnectionInput, context: MarketplaceAdapterContext): Promise<ConnectorHealth>;
  disconnect(context: MarketplaceAdapterContext): Promise<ConnectorHealth>;
  health(context: MarketplaceAdapterContext): Promise<ConnectorHealth>;
  publish(draft: ChannelListingDraft, context: MarketplaceAdapterContext): Promise<ConnectorOperationResult>;
  update(draft: ChannelListingDraft, context: MarketplaceAdapterContext): Promise<ConnectorOperationResult>;
  endListing(draft: ChannelListingDraft, context: MarketplaceAdapterContext): Promise<ConnectorOperationResult>;
  relist(draft: ChannelListingDraft, context: MarketplaceAdapterContext): Promise<ConnectorOperationResult>;
  sync(draft: ChannelListingDraft, input: { quantity?: number }, context: MarketplaceAdapterContext): Promise<ConnectorOperationResult>;
  uploadImages(draft: ChannelListingDraft, context: MarketplaceAdapterContext): Promise<ConnectorOperationResult>;
  validateDraft(draft: ChannelListingDraft): string[];
  translateDraft(draft: ChannelListingDraft): Record<string, unknown>;
  diagnostics(context: MarketplaceAdapterContext): MarketplaceConnectorDiagnostic[];
}

export function ensureMarketplaceConnectorCollections(data: OperatingData) {
  data.marketplaceConnectorCredentials ||= [];
  data.marketplaceConnectorDiagnostics ||= [];
  data.marketplaceListingSnapshots ||= [];
}

export function failureCodeForConnectorError(error: unknown): MarketplacePublishTask["failureCode"] | "credentials_missing" | "connector_not_configured" | "scope_missing" | "schema_mismatch" {
  if (error instanceof ConnectorError) return error.failureCode;
  return "unknown_connector_response";
}

export function normalizeConnectorError(error: unknown): ConnectorError {
  if (error instanceof ConnectorError) return error;
  return new ConnectorError(error instanceof Error ? error.message : "Marketplace connector failed.", "unknown", "unknown_connector_response", true);
}

export function publishFailureCode(error: ConnectorError): MarketplacePublishTask["failureCode"] {
  return error.failureCode === "credentials_missing" || error.failureCode === "connector_not_configured" || error.failureCode === "scope_missing" || error.failureCode === "schema_mismatch" ? "authentication_expired" : error.failureCode;
}

export function listingFromDraft(draft: ChannelListingDraft, result: ConnectorOperationResult, status: MarketplaceListingSnapshot["status"] = "active"): MarketplaceListing {
  const observedAt = new Date().toISOString();
  return {
    externalId: result.externalId,
    url: result.externalUrl,
    status,
    inventory: draft.quantity,
    price: draft.price,
    currency: typeof draft.attributes.currency === "string" ? draft.attributes.currency : "USD",
    lastSync: observedAt,
    images: draft.imageUrls,
    diagnostics: result.metadata,
    timestamps: { observedAt, updatedAt: observedAt },
  };
}

export function recordMarketplaceDiagnostic(data: OperatingData, adapter: Pick<MarketplaceAdapter, "marketplace" | "connectorVersion">, input: Omit<MarketplaceConnectorDiagnostic, "id" | "createdAt" | "connectorVersion" | "marketplace"> & { marketplace?: Exclude<Marketplace, "Manual"> }) {
  ensureMarketplaceConnectorCollections(data);
  const createdAt = new Date().toISOString();
  const diagnostic: MarketplaceConnectorDiagnostic = { id: deterministicUuid(`connector-diagnostic:${adapter.marketplace}:${input.operation}:${input.draftId || input.accountId || "global"}:${createdAt}`), marketplace: input.marketplace || adapter.marketplace, connectorVersion: adapter.connectorVersion, createdAt, ...input };
  data.marketplaceConnectorDiagnostics!.unshift(diagnostic);
  return diagnostic;
}

export function recordMarketplaceSnapshot(data: OperatingData, adapter: Pick<MarketplaceAdapter, "marketplace" | "connectorVersion">, draft: ChannelListingDraft, productId: string, result: ConnectorOperationResult, source: MarketplaceListingSnapshot["source"] = "publish_response") {
  ensureMarketplaceConnectorCollections(data);
  const listing = result.listing || listingFromDraft(draft, result);
  const snapshot: MarketplaceListingSnapshot = { id: deterministicUuid(`connector-snapshot:${adapter.marketplace}:${draft.id}:${listing.externalId}`), marketplace: adapter.marketplace, draftId: draft.id, productId, variantId: draft.variantId, externalListingId: listing.externalId, externalUrl: listing.url, status: listing.status, title: draft.title, description: draft.description, price: listing.price, quantity: listing.inventory, category: draft.category, imageUrls: listing.images, observedAt: listing.timestamps.observedAt, source, connectorVersion: adapter.connectorVersion, metadata: result.metadata };
  data.marketplaceListingSnapshots = [snapshot, ...data.marketplaceListingSnapshots!.filter((entry) => entry.id !== snapshot.id)];
  return snapshot;
}

export class MarketplaceRegistry {
  private readonly adapters = new Map<string, MarketplaceAdapter>();
  register(adapter: MarketplaceAdapter) {
    this.adapters.set(adapter.marketplace.toLowerCase(), adapter);
    return adapter;
  }
  get(marketplace: string) {
    return this.adapters.get(marketplace.toLowerCase());
  }
  list() {
    return [...this.adapters.values()];
  }
  clear() {
    this.adapters.clear();
  }
}

export const marketplaceRegistry = new MarketplaceRegistry();

export const ConnectorFactory = {
  forMarketplace(marketplace: Exclude<Marketplace, "Manual">) {
    const adapter = marketplaceRegistry.get(marketplace);
    if (!adapter) throw new ConnectorError(`No marketplace adapter is registered for ${marketplace}.`, "configuration", "connector_not_configured", false);
    return adapter;
  },
  registeredAdapters() {
    return marketplaceRegistry.list();
  },
};

export class ConnectorRuntime {
  static async execute(adapter: MarketplaceAdapter, operation: MarketplaceAdapterOperation, run: () => Promise<ConnectorOperationResult>) {
    const started = Date.now();
    try {
      const result = await run();
      return { ...result, metadata: { connectorVersion: adapter.connectorVersion, operation, durationMs: Date.now() - started, ...result.metadata } };
    } catch (error) {
      const normalized = normalizeConnectorError(error);
      throw new ConnectorError(normalized.message, normalized.type, normalized.failureCode, normalized.retryable, normalized.httpStatus, normalized.requestId, { connectorVersion: adapter.connectorVersion, operation, durationMs: Date.now() - started, ...normalized.metadata }, normalized.retryDelayMs);
    }
  }
}

const fixtureCapabilities: MarketplaceAdapterCapabilities = {
  supportsPublish: true,
  supportsUpdate: true,
  supportsEndListing: true,
  supportsRelist: true,
  supportsInventorySync: true,
  supportsDraftValidation: true,
  supportsImageOrdering: true,
  supportsBulkPublish: true,
  supportsOffers: false,
  supportsBundles: false,
  supportsShippingProfiles: false,
};

export class FixtureMarketplaceAdapter implements MarketplaceAdapter {
  readonly connectorVersion: string;
  readonly capabilities = fixtureCapabilities;
  constructor(readonly marketplace: Exclude<Marketplace, "Manual">, version = "fixture-marketplace-adapter-v1") {
    this.connectorVersion = `${marketplace.toLowerCase()}-${version}`;
  }
  runtimeMode() { return "fixture" as const; }
  async connect(input: AdapterConnectionInput, context: MarketplaceAdapterContext) {
    void input; void context;
    return this.health(context);
  }
  async disconnect(context: MarketplaceAdapterContext) {
    void context;
    return { marketplace: this.marketplace, connected: false, healthy: true, authState: "disconnected" as const, mode: "fixture" as const, rateLimit: "healthy" as const, errors: [], warnings: ["Fixture adapter disconnected."], connectorVersion: this.connectorVersion };
  }
  async health(context: MarketplaceAdapterContext) {
    void context;
    return { marketplace: this.marketplace, connected: true, healthy: true, authState: "connected" as const, mode: "fixture" as const, rateLimit: "healthy" as const, errors: [], warnings: ["Fixture adapter does not contact a live marketplace."], connectorVersion: this.connectorVersion };
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
    return { title: draft.title, description: draft.description, price: draft.price, quantity: draft.quantity, category: draft.category, images: draft.imageUrls };
  }
  private result(draft: ChannelListingDraft, operation: MarketplaceAdapterOperation, status: MarketplaceListingSnapshot["status"] = "active", quantity = draft.quantity): ConnectorOperationResult {
    const externalId = draft.externalListingId || `${this.marketplace.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${draft.id.slice(0, 8)}`;
    const externalUrl = draft.externalUrl || `https://example.test/${this.marketplace.toLowerCase()}/listing/${externalId}`;
    const result = { externalId, externalUrl, requestId: deterministicUuid(`fixture-adapter:${this.marketplace}:${operation}:${draft.id}:${quantity}`), httpStatus: operation === "end" ? 204 : 200, metadata: { mode: "fixture", operation, quantity } };
    return { ...result, listing: listingFromDraft({ ...draft, quantity }, result, status) };
  }
  async publish(draft: ChannelListingDraft) {
    const errors = this.validateDraft(draft);
    if (errors.length) throw new ConnectorError(errors.join(" "), "validation", "validation_rejected", false, 422);
    return ConnectorRuntime.execute(this, "publish", async () => this.result(draft, "publish"));
  }
  async update(draft: ChannelListingDraft) {
    return ConnectorRuntime.execute(this, "update", async () => this.result(draft, "update"));
  }
  async endListing(draft: ChannelListingDraft) {
    return ConnectorRuntime.execute(this, "end", async () => this.result(draft, "end", "ended", 0));
  }
  async relist(draft: ChannelListingDraft) {
    return ConnectorRuntime.execute(this, "relist", async () => this.result(draft, "relist"));
  }
  async sync(draft: ChannelListingDraft, input: { quantity?: number }) {
    return ConnectorRuntime.execute(this, "sync_inventory", async () => this.result(draft, "sync_inventory", "active", input.quantity ?? draft.quantity));
  }
  async uploadImages(draft: ChannelListingDraft) {
    return ConnectorRuntime.execute(this, "upload_images", async () => this.result(draft, "upload_images"));
  }
  diagnostics(context: MarketplaceAdapterContext) {
    return (context.data.marketplaceConnectorDiagnostics || []).filter((entry) => entry.marketplace === this.marketplace);
  }
}
