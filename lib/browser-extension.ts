import type { ChannelListingDraft, ExtensionArtifact, Marketplace, OperatingData, Product, Supplier, Variant } from "../domain/business";
import type { SuperbuyProduct } from "../types/superbuy-product";
import { parseSuperbuyProduct } from "./validation/superbuy-product";
import { createFiveChannelDrafts, seedMarketplaceAccountsAndTemplates, syncDraftQuantity, pauseOrDelistDraft, confirmExternalListing } from "./listings-core";
import { money } from "./business-calculations";
import { adapterForMarketplace, adapterHealth, marketplaceAdapters } from "./extension-adapters";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
export const extensionVersion = "1.1.0-phase2";

export type ExtensionAction =
  | { action: "register-device"; deviceName: string; browser: string; environment: "local" | "staging" | "production"; version: string; permissions: string[]; deviceId?: string; idempotencyKey?: string }
  | { action: "revoke-device"; deviceId: string; reason?: string; idempotencyKey?: string }
  | { action: "scan-intake"; payload: unknown; idempotencyKey?: string }
  | { action: "analyze"; product: unknown; assumptions?: Partial<ProfitabilityAssumptions>; idempotencyKey?: string }
  | { action: "import-product"; product: unknown; assumptions?: Partial<ProfitabilityAssumptions>; approved?: boolean; idempotencyKey?: string }
  | { action: "create-publish-job"; draftId: string; idempotencyKey?: string }
  | { action: "confirm-publish"; draftId: string; externalListingId: string; externalUrl: string; finalTitle?: string; finalPrice?: number; evidence?: ExtensionArtifactPayload; idempotencyKey?: string }
  | { action: "report-error"; draftId?: string; marketplace?: Marketplace; reason: string; classification?: "retryable" | "permanent"; screenshotUrl?: string; artifact?: ExtensionArtifactPayload; idempotencyKey?: string }
  | { action: "sync-quantity"; draftId: string; quantity?: number; idempotencyKey?: string }
  | { action: "pause-draft" | "delist-draft"; draftId: string; reason?: string; idempotencyKey?: string };

export type ExtensionArtifactPayload = { type?: ExtensionArtifact["type"]; url?: string; metadata?: Record<string, unknown>; failedSelector?: string; pageVersion?: string; currentUrl?: string; domSnapshotHash?: string; log?: string; marketplace?: Marketplace };

export type ProfitabilityAssumptions = {
  rmbUsdRate: number;
  internationalFreightPerKgUsd: number;
  dutyRate: number;
  customsFlatUsd: number;
  expectedShippingUsd: number;
  packagingUsd: number;
  paymentFeeRate: number;
  paymentFeeFlatUsd: number;
  marketplaceFeeRates: Record<Exclude<Marketplace, "Manual">, number>;
  targetSalePriceUsd?: number;
  quantity?: number;
};

export function defaultProfitabilityAssumptions(): ProfitabilityAssumptions {
  return { rmbUsdRate: 0.14, internationalFreightPerKgUsd: 8, dutyRate: 0.08, customsFlatUsd: 0, expectedShippingUsd: 7.5, packagingUsd: 1.2, paymentFeeRate: 0.029, paymentFeeFlatUsd: 0.3, marketplaceFeeRates: { Depop: 0.1, eBay: 0.1325, Etsy: 0.095, Mercari: 0.1, Poshmark: 0.2 }, quantity: 1 };
}

function audit(data: OperatingData, action: string, entityType: string, entityId: string, detail: string) {
  data.activity.unshift({ id: id(), action, entityType, entityId, detail, createdAt: now() });
}

export function ensureExtensionCollections(data: OperatingData) {
  data.extensionDevices ||= [];
  data.extensionSessions ||= [];
  data.extensionArtifacts ||= [];
  data.extensionActionAudits ||= [];
  data.listingReviewItems ||= [];
  data.durableJobs ||= [];
  data.deadLetters ||= [];
}

export function hashExtensionToken(token: string) {
  let hash = 0;
  for (const char of token) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `sha256-ready-${hash.toString(16).padStart(8, "0")}`;
}

function persistArtifact(data: OperatingData, payload: ExtensionArtifactPayload | undefined, defaults: { deviceId?: string; draftId?: string; marketplace?: Marketplace; type?: ExtensionArtifact["type"] }) {
  ensureExtensionCollections(data);
  if (!payload && !defaults.type) return undefined;
  const marketplace = (payload?.marketplace || defaults.marketplace) as Exclude<Marketplace, "Manual"> | undefined;
  const artifact: ExtensionArtifact = { id: id(), deviceId: defaults.deviceId, draftId: defaults.draftId, marketplace, type: payload?.type || defaults.type || "log", storageProvider: payload?.url ? "external" : "local_metadata", url: payload?.url, metadata: { ...(payload?.metadata || {}), failedSelector: payload?.failedSelector, pageVersion: payload?.pageVersion, currentUrl: payload?.currentUrl, domSnapshotHash: payload?.domSnapshotHash, log: payload?.log }, createdAt: now() };
  data.extensionArtifacts!.unshift(artifact);
  return artifact;
}

function actionAudit(data: OperatingData, action: string, status: "succeeded" | "failed" | "blocked", detail: string, options: { deviceId?: string; draftId?: string; marketplace?: Marketplace; correlationId?: string; nonce?: string; artifactIds?: string[] } = {}) {
  ensureExtensionCollections(data);
  data.extensionActionAudits!.unshift({ id: id(), deviceId: options.deviceId, action, status, marketplace: options.marketplace as Exclude<Marketplace, "Manual"> | undefined, draftId: options.draftId, correlationId: options.correlationId || id(), nonce: options.nonce, detail, artifactIds: options.artifactIds || [], createdAt: now() });
}

export function registerExtensionDevice(data: OperatingData, input: Extract<ExtensionAction, { action: "register-device" }>) {
  ensureExtensionCollections(data);
  const createdAt = now();
  const device = input.deviceId ? data.extensionDevices!.find((entry) => entry.id === input.deviceId) : undefined;
  const deviceId = device?.id || id();
  const token = crypto.randomUUID();
  if (device) {
    device.version = input.version;
    device.browser = input.browser;
    device.environment = input.environment;
    device.permissions = input.permissions;
    device.status = "active";
    device.lastSeenAt = createdAt;
    device.revokedAt = undefined;
  } else {
    data.extensionDevices!.push({ id: deviceId, name: input.deviceName, browser: input.browser, environment: input.environment, version: input.version, permissions: input.permissions, status: "active", lastSeenAt: createdAt, createdAt });
  }
  data.extensionSessions!.push({ id: id(), deviceId, tokenHash: hashExtensionToken(token), issuedAt: createdAt, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), usedNonces: [] });
  actionAudit(data, "register-device", "succeeded", `${input.deviceName} registered for ${input.environment}.`, { deviceId });
  return { deviceId, token, expiresAt: data.extensionSessions!.at(-1)?.expiresAt, extensionVersion };
}

export function revokeExtensionDevice(data: OperatingData, input: Extract<ExtensionAction, { action: "revoke-device" }>) {
  ensureExtensionCollections(data);
  const device = data.extensionDevices!.find((entry) => entry.id === input.deviceId);
  if (!device) throw new Error("Extension device not found.");
  device.status = "revoked";
  device.revokedAt = now();
  for (const session of data.extensionSessions!.filter((entry) => entry.deviceId === input.deviceId)) session.revokedAt = now();
  actionAudit(data, "revoke-device", "succeeded", input.reason || "Extension device revoked.", { deviceId: input.deviceId });
  return { device };
}

function weightKg(product: SuperbuyProduct) {
  const raw = product.shippingWeight || product.weight || "";
  const match = raw.replace(",", "").match(/([\d.]+)\s*(kg|g|lb|oz)?/i);
  if (!match) return 0.5;
  const value = Number(match[1]);
  const unit = (match[2] || "g").toLowerCase();
  if (unit === "kg") return value;
  if (unit === "lb") return value * 0.453592;
  if (unit === "oz") return value * 0.0283495;
  return value / 1000;
}

export function analyzeExtensionProduct(input: unknown, overrides: Partial<ProfitabilityAssumptions> = {}) {
  const product = parseSuperbuyProduct(input);
  const assumptions = { ...defaultProfitabilityAssumptions(), ...overrides, marketplaceFeeRates: { ...defaultProfitabilityAssumptions().marketplaceFeeRates, ...overrides.marketplaceFeeRates } };
  const rmbPrice = product.priceRange?.min ?? product.price ?? 0;
  const quantity = Math.max(1, assumptions.quantity || product.minimumOrderQuantity || 1);
  const purchaseCostUsd = Math.round(rmbPrice * assumptions.rmbUsdRate * 100) / 100;
  const domesticFreightUsd = Math.round((product.domesticShipping || 0) * assumptions.rmbUsdRate * 100) / 100;
  const internationalFreightUsd = Math.round(weightKg(product) * assumptions.internationalFreightPerKgUsd * 100) / 100;
  const dutyCustomsUsd = Math.round((purchaseCostUsd * assumptions.dutyRate + assumptions.customsFlatUsd) * 100) / 100;
  const landedUnitCost = Math.round((purchaseCostUsd + domesticFreightUsd + internationalFreightUsd + dutyCustomsUsd) * 100) / 100;
  const targetSalePrice = assumptions.targetSalePriceUsd || Math.max(landedUnitCost * 2.7, landedUnitCost + 25);
  const byMarketplace = Object.entries(assumptions.marketplaceFeeRates).map(([marketplace, feeRate]) => {
    const platformFee = targetSalePrice * feeRate;
    const paymentFee = targetSalePrice * assumptions.paymentFeeRate + assumptions.paymentFeeFlatUsd;
    const expectedProfit = targetSalePrice - landedUnitCost - platformFee - paymentFee - assumptions.expectedShippingUsd - assumptions.packagingUsd;
    return { marketplace: marketplace as Exclude<Marketplace, "Manual">, targetSalePrice, platformFee, paymentFee, expectedShippingCost: assumptions.expectedShippingUsd, landedUnitCost, expectedProfit, contributionMargin: targetSalePrice ? expectedProfit / targetSalePrice * 100 : 0, roi: landedUnitCost ? expectedProfit / landedUnitCost * 100 : 0, breakEvenPrice: landedUnitCost + platformFee + paymentFee + assumptions.expectedShippingUsd + assumptions.packagingUsd };
  });
  return { product, assumptions, purchaseCostUsd, domesticFreightUsd, internationalFreightUsd, dutyCustomsUsd, landedUnitCost, cashCommitment: landedUnitCost * quantity, quantity, byMarketplace };
}

function supplierName(product: SuperbuyProduct) {
  return product.storeName || product.factoryName || product.supplier || "Extension supplier";
}

function physicalSku(product: SuperbuyProduct) {
  return `FST-${supplierName(product).slice(0, 3).replace(/[^a-z0-9]/gi, "").toUpperCase() || "SRC"}-${Math.abs([...product.superbuyUrl].reduce((sum, char) => sum + char.charCodeAt(0), 0)).toString(36).toUpperCase()}`;
}

export function importExtensionProduct(data: OperatingData, input: unknown, assumptions: Partial<ProfitabilityAssumptions> = {}, idempotencyKey?: string) {
  const analysis = analyzeExtensionProduct(input, assumptions);
  const product = analysis.product;
  const existing = data.products.find((entry) => entry.sourceUrl === product.superbuyUrl);
  if (existing) {
    const variant = data.variants.find((entry) => entry.productId === existing.id);
    if (variant) {
      seedMarketplaceAccountsAndTemplates(data);
      createFiveChannelDrafts(data, { variantId: variant.id, physicalSku: variant.sku, basePrice: variant.defaultSalePrice, imageUrls: product.images, idempotencyKey });
    }
    return { analysis, productId: existing.id, variantId: variant?.id, idempotent: true, drafts: data.channelListingDrafts?.filter((draft) => draft.variantId === variant?.id) || [] };
  }
  const createdAt = now();
  let supplier: Supplier | undefined = data.suppliers.find((entry) => entry.name.toLowerCase() === supplierName(product).toLowerCase());
  if (!supplier) { supplier = { id: id(), name: supplierName(product), contact: product.supplier, sourcePlatform: product.source, leadDays: 12, rating: product.sellerRating, status: "active", notes: `Created by Faust extension from ${product.superbuyUrl}` }; data.suppliers.push(supplier); }
  const catalogProduct: Product = { id: id(), title: product.title, category: product.category || "Imported source product", tags: ["extension-import", product.source], supplierId: supplier.id, sourceUrl: product.superbuyUrl, image: product.images[0], status: "draft", createdAt, updatedAt: createdAt };
  data.products.push(catalogProduct);
  const sku = physicalSku(product);
  const variant: Variant = { id: id(), productId: catalogProduct.id, sku, title: product.variants[0]?.name || "Default variant", condition: "New with tags", landedUnitCost: analysis.landedUnitCost, defaultSalePrice: analysis.byMarketplace[0]?.targetSalePrice || analysis.landedUnitCost * 3, weightOz: Math.round(weightKg(product) * 35.274 * 10) / 10, reorderPoint: Math.max(1, Math.min(5, product.minimumOrderQuantity || 2)), reorderQuantity: Math.max(product.minimumOrderQuantity || 1, analysis.quantity), active: true };
  data.variants.push(variant);
  data.balances.push({ id: id(), variantId: variant.id, onHand: 0, reserved: 0, incoming: analysis.quantity, damaged: 0, returned: 0, lost: 0, quarantined: 0 });
  data.purchaseBatches ||= [];
  data.landedCostComponents ||= [];
  const batchId = id();
  data.purchaseBatches.push({ id: batchId, supplierId: supplier.id, reference: `EXT-DRAFT-${sku}`, currency: product.source === "1688" ? "RMB" : "USD", status: "draft", itemCount: analysis.quantity, subtotalOriginal: product.price || 0, subtotalUsd: analysis.purchaseCostUsd * analysis.quantity, landedCostUsd: (analysis.domesticFreightUsd + analysis.internationalFreightUsd + analysis.dutyCustomsUsd) * analysis.quantity, totalCostUsd: analysis.cashCommitment, receivedAt: createdAt, idempotencyKey, createdAt, updatedAt: createdAt });
  data.landedCostComponents.push({ id: id(), batchId, type: "product", description: "Extension source product estimate", amountOriginal: product.price || 0, currency: product.source === "1688" ? "RMB" : "USD", amountUsd: analysis.purchaseCostUsd, allocationMethod: "by_quantity", linkedObjectType: "manual", linkedObjectId: catalogProduct.id, createdAt });
  seedMarketplaceAccountsAndTemplates(data);
  createFiveChannelDrafts(data, { variantId: variant.id, physicalSku: sku, basePrice: variant.defaultSalePrice, imageUrls: product.images, idempotencyKey });
  const drafts = data.channelListingDrafts?.filter((draft) => draft.variantId === variant.id) || [];
  audit(data, "Extension product imported", "product", catalogProduct.id, `${product.title} imported with ${drafts.length} channel drafts. Cash commitment ${money(analysis.cashCommitment)}.`);
  data.notices.unshift({ id: id(), severity: "info", title: "Extension import ready", detail: `${product.title} created ${drafts.length} marketplace drafts.`, actionLabel: "Open listings", href: "/listings", createdAt, category: "system", entityType: "product", entityId: catalogProduct.id, read: false });
  return { analysis, productId: catalogProduct.id, variantId: variant.id, idempotent: false, drafts };
}

export function createExtensionPublishJob(data: OperatingData, draftId: string, idempotencyKey?: string) {
  seedMarketplaceAccountsAndTemplates(data);
  const draft = data.channelListingDrafts?.find((entry) => entry.id === draftId);
  if (!draft) throw new Error("Listing draft not found.");
  data.listingSyncJobs ||= [];
  const existing = idempotencyKey ? data.listingSyncJobs.find((job) => job.idempotencyKey === idempotencyKey) : undefined;
  if (existing) return { draft, job: existing };
  const job = { id: id(), channelDraftId: draft.id, marketplace: draft.marketplace, action: "publish" as const, status: draft.publishMode === "adapter" ? "queued" as const : "manual_required" as const, attempts: 0, maxAttempts: 3, idempotencyKey, runAfter: now(), createdAt: now() };
  data.listingSyncJobs.push(job);
  draft.status = draft.publishMode === "adapter" ? "queued" : "manual_required";
  draft.syncState = draft.publishMode === "adapter" ? "pending" : "manual";
  audit(data, "Extension publish job created", "channel_listing_draft", draft.id, `${draft.marketplace} publish job queued.`);
  actionAudit(data, "create-publish-job", "succeeded", `${draft.marketplace} publish progress: waiting → opening → validating.`, { draftId: draft.id, marketplace: draft.marketplace });
  return { draft, job };
}

export function confirmExtensionPublish(data: OperatingData, input: Extract<ExtensionAction, { action: "confirm-publish" }>) {
  confirmExternalListing(data, { draftId: input.draftId, externalListingId: input.externalListingId, externalUrl: input.externalUrl, idempotencyKey: input.idempotencyKey });
  const draft = data.channelListingDrafts!.find((entry) => entry.id === input.draftId)!;
  if (input.finalTitle) draft.title = input.finalTitle;
  if (input.finalPrice) draft.price = input.finalPrice;
  const artifact = persistArtifact(data, input.evidence, { draftId: draft.id, marketplace: draft.marketplace, type: "publish_confirmation" });
  audit(data, "Extension publish confirmed", "channel_listing_draft", draft.id, `${draft.marketplace} confirmed ${input.externalListingId}.`);
  actionAudit(data, "confirm-publish", "succeeded", `${draft.marketplace} publish progress: confirming → succeeded.`, { draftId: draft.id, marketplace: draft.marketplace, artifactIds: artifact ? [artifact.id] : [] });
  return draft;
}

export function reportExtensionFailure(data: OperatingData, input: Extract<ExtensionAction, { action: "report-error" }>) {
  ensureExtensionCollections(data);
  const artifact = persistArtifact(data, input.artifact || (input.screenshotUrl ? { type: "screenshot", url: input.screenshotUrl } : undefined), { draftId: input.draftId, marketplace: input.marketplace, type: "log" });
  const classification = input.classification || "retryable";
  const review = { id: id(), channelDraftId: input.draftId, marketplace: (input.marketplace || "Depop") as Exclude<Marketplace, "Manual">, severity: "warning" as const, reason: "sync_failed" as const, status: "open" as const, detail: input.reason, actionLabel: "Retry or finish manually", createdAt: now() };
  data.listingReviewItems!.unshift(review);
  if (input.draftId) {
    const draft = data.channelListingDrafts?.find((entry) => entry.id === input.draftId);
    if (draft) { draft.status = "failed"; draft.syncState = "risk_locked"; draft.riskLockId ||= id(); }
  }
  if (classification === "permanent") data.deadLetters!.unshift({ id: id(), sourceType: "durable_job", sourceId: input.draftId || review.id, reason: input.reason, payload: { marketplace: input.marketplace, artifactId: artifact?.id }, createdAt: now() });
  else data.durableJobs!.unshift({ id: id(), queue: "marketplace_publish", status: "queued", payload: { draftId: input.draftId, marketplace: input.marketplace, reviewId: review.id, idempotencyKey: input.idempotencyKey }, attempts: 0, maxAttempts: 3, runAfter: new Date(Date.now() + 5 * 60 * 1000).toISOString(), createdAt: now() });
  data.notices.unshift({ id: id(), severity: "warning", title: "Extension publish blocked", detail: input.reason, actionLabel: "Review listing", href: "/listings", createdAt: now(), category: "system", entityType: "listing_review_item", entityId: review.id, read: false });
  audit(data, "Extension failure reported", "listing_review_item", review.id, input.reason);
  actionAudit(data, "report-error", "failed", `${classification} extension failure: ${input.reason}`, { draftId: input.draftId, marketplace: input.marketplace, artifactIds: artifact ? [artifact.id] : [] });
  return review;
}

export function extensionConnectionSummary(data: OperatingData) {
  ensureExtensionCollections(data);
  return { devices: data.extensionDevices, sessions: data.extensionSessions?.map((session) => ({ id: session.id, deviceId: session.deviceId, expiresAt: session.expiresAt, revokedAt: session.revokedAt, usedNonceCount: session.usedNonces.length })), artifacts: data.extensionArtifacts, actions: data.extensionActionAudits, adapters: Object.values(marketplaceAdapters).map(adapterHealth) };
}

export function applyExtensionAction(data: OperatingData, input: ExtensionAction) {
  ensureExtensionCollections(data);
  if (input.action === "register-device") return registerExtensionDevice(data, input);
  if (input.action === "revoke-device") return revokeExtensionDevice(data, input);
  if (input.action === "scan-intake") return { product: parseSuperbuyProduct(input.payload), extensionVersion };
  if (input.action === "analyze") return analyzeExtensionProduct(input.product, input.assumptions);
  if (input.action === "import-product") { if (!input.approved) throw new Error("Import must be approved from the extension review screen."); return importExtensionProduct(data, input.product, input.assumptions, input.idempotencyKey); }
  if (input.action === "create-publish-job") return createExtensionPublishJob(data, input.draftId, input.idempotencyKey);
  if (input.action === "confirm-publish") return confirmExtensionPublish(data, input);
  if (input.action === "report-error") return reportExtensionFailure(data, input);
  if (input.action === "sync-quantity") return syncDraftQuantity(data, { draftId: input.draftId, quantity: input.quantity, idempotencyKey: input.idempotencyKey });
  if (input.action === "pause-draft") return pauseOrDelistDraft(data, { draftId: input.draftId, mode: "pause", reason: input.reason, idempotencyKey: input.idempotencyKey });
  if (input.action === "delist-draft") return pauseOrDelistDraft(data, { draftId: input.draftId, mode: "delist", reason: input.reason, idempotencyKey: input.idempotencyKey });
  throw new Error("Unsupported extension action.");
}

export function marketplaceFormMapping(draft: ChannelListingDraft) {
  const adapter = adapterForMarketplace(draft.marketplace);
  return { adapterVersion: adapter.version, supportedUrlPatterns: adapter.supportedUrlPatterns, listingUrl: adapter.listingUrl, title: draft.title, description: draft.description, category: adapter.categoryMap[draft.category.toLowerCase()] || draft.category, price: draft.price, condition: adapter.conditionMap[(draft.attributes.condition || "new with tags").toLowerCase()] || draft.attributes.condition || "New with tags", quantity: draft.quantity, sku: draft.physicalSku, images: draft.imageUrls, attributes: draft.attributes, shipping: adapter.shippingMap.standard || "Standard seller-paid shipping", selectors: adapter.fields, imageUpload: adapter.images, fallbackStrategy: adapter.fallbackStrategy };
}
