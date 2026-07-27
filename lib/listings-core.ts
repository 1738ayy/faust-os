import type { ChannelListingDraft, CrossListingJob, DurableJob, Listing, ListingReviewItem, ListingSyncJob, ListingTemplate, Marketplace, MarketplaceAccountDefault, MarketplacePublishTask, OperatingData, PhysicalSkuMapping, ProductMarketplaceOverride, ProductMarketplaceStatus, TransactionalOutboxEvent } from "@/domain/business";
import { availableUnits } from "./business-calculations";
import { isActiveVariant } from "./product-state";
import { getMarketplaceAdapter } from "../services/adapters/marketplace";
import { MarketplaceEngine, getMarketplaceProfile } from "./marketplace-intelligence";
import type { ManagedMarketplace, MarketplaceDraftInspector } from "./marketplace-intelligence";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
export const crossListingChannels = ["Depop", "eBay", "Etsy", "Mercari", "Poshmark"] as const;
const providerId = (marketplace: Marketplace) => marketplace === "eBay" ? "ebay" : marketplace.toLowerCase();

export type CreateCrossListingInput = { variantId: string; physicalSku?: string; basePrice?: number; imageUrls?: string[]; idempotencyKey?: string };
export type ListingActionInput = { draftId: string; idempotencyKey?: string; externalListingId?: string; externalUrl?: string; quantity?: number; reason?: string };
export type MarketplaceDefaultInput = { marketplaceAccountId: string; fieldKey: string; value: MarketplaceAccountDefault["value"]; universalCategoryId?: string | null; enabled?: boolean; actor?: string };
export type ProductOverrideInput = { productId: string; marketplace: ManagedMarketplace; fieldKey: string; value: ProductMarketplaceOverride["value"]; marketplaceAccountId?: string; variantId?: string; actor?: string };
export type CrossListingPublishInput = { productId: string; marketplaces?: ManagedMarketplace[]; initiatedBy?: string; inventoryStrategy?: CrossListingJob["inventoryStrategy"]; idempotencyKey?: string };

export function ensureListingsCollections(data: OperatingData) {
  data.marketplaceAccounts ||= [];
  data.listingTemplates ||= [];
  data.channelListingDrafts ||= [];
  data.listingSyncJobs ||= [];
  data.listingReviewItems ||= [];
  data.physicalSkuMappings ||= [];
  data.channelSyncStates ||= [];
  data.inventoryRiskLocks ||= [];
  data.outboxEvents ||= [];
  data.durableJobs ||= [];
  data.marketplaceAccountDefaults ||= [];
  data.productMarketplaceOverrides ||= [];
  data.marketplaceImageOrders ||= [];
  data.crossListingJobs ||= [];
  data.marketplacePublishTasks ||= [];
  data.productListingSyncReviews ||= [];
}

export function seedMarketplaceAccountsAndTemplates(data: OperatingData) {
  ensureListingsCollections(data);
  for (const marketplace of crossListingChannels) {
    const profile = getMarketplaceProfile(marketplace);
    if (!data.marketplaceAccounts!.some((account) => account.marketplace === marketplace)) {
      data.marketplaceAccounts!.push({
        id: id(),
        marketplace,
        displayName: `${marketplace} default`,
        status: profile.capabilities.publishing === "adapter" ? "adapter_ready" : profile.capabilities.publishing === "extension" ? "extension_assisted" : "manual",
        supportsApiPublish: profile.capabilities.publishing === "adapter",
        supportsExtension: profile.capabilities.publishing === "extension",
        createdAt: now(),
      });
    }
    if (!data.listingTemplates!.some((template) => template.marketplace === marketplace)) {
      data.listingTemplates!.push({
        id: id(),
        name: `${marketplace} profile-backed template`,
        marketplace,
        category: profile.categories.find((entry) => entry.universalCategoryId === "apparel.tops.hoodies")?.categoryPath.join(" > ") || "Clothing",
        titleFormat: "{title} - {sku}",
        descriptionFormat: "{title}\n\nCondition: {condition}\nPhysical SKU: {physicalSku}\nShips from Faust OS inventory.",
        priceAdjustmentPercent: profile.pricingRules.defaultAdjustmentPercent,
        defaultAttributes: { condition: profile.enums.condition[profile.accountDefaults.defaultCondition].label, shippingService: profile.accountDefaults.shippingService },
        imagePolicy: profile.imageRules.preferredAspectRatio === "1:1" ? "square_crop" : profile.imageRules.maxImages <= 4 ? "first_four" : "all",
        shippingProfile: profile.shippingRules.defaultService,
        createdAt: now(),
      });
    }
  }
}

function activity(data: OperatingData, action: string, entityType: string, entityId: string, detail: string) {
  data.activity.unshift({ id: id(), action, entityType, entityId, detail, createdAt: now() });
}

function review(data: OperatingData, input: Omit<ListingReviewItem, "id" | "createdAt" | "status" | "actionLabel"> & { actionLabel?: string }) {
  ensureListingsCollections(data);
  const existing = data.listingReviewItems!.find((entry) => entry.status === "open" && entry.channelDraftId === input.channelDraftId && entry.reason === input.reason);
  if (existing) return existing;
  const item: ListingReviewItem = { id: id(), status: "open", actionLabel: input.actionLabel || "Review listing", createdAt: now(), ...input };
  data.listingReviewItems!.unshift(item);
  data.notices.unshift({ id: id(), severity: input.severity, title: `Listing ${input.reason.replaceAll("_", " ")}`, detail: input.detail, actionLabel: item.actionLabel, href: "/listings", createdAt: now(), category: "system", entityType: "listing_review_item", entityId: item.id, read: false });
  return item;
}

function addOutboxJob(data: OperatingData, topic: TransactionalOutboxEvent["topic"], draft: ChannelListingDraft, action: ListingSyncJob["action"], payload: Record<string, unknown>, idempotencyKey?: string) {
  ensureListingsCollections(data);
  const createdAt = now();
  const eventIdempotencyKey = idempotencyKey ? draft.id : undefined;
  const event: TransactionalOutboxEvent = { id: id(), topic, aggregateType: "channel_listing_draft", aggregateId: draft.id, payload, status: "pending", attempts: 0, idempotencyKey: eventIdempotencyKey, createdAt, updatedAt: createdAt };
  const job: DurableJob = { id: id(), queue: topic.includes("quantity") || topic.includes("sold") ? "channel_sync" : "marketplace_publish", eventId: event.id, status: "queued", attempts: 0, maxAttempts: 3, payload, runAfter: createdAt, createdAt, updatedAt: createdAt };
  const listingJob: ListingSyncJob = { id: id(), channelDraftId: draft.id, marketplace: draft.marketplace, action, status: action === "publish" && draft.publishMode !== "adapter" ? "manual_required" : "queued", attempts: 0, maxAttempts: 3, idempotencyKey, runAfter: createdAt, createdAt, updatedAt: createdAt };
  data.outboxEvents!.unshift(event);
  data.durableJobs!.unshift(job);
  data.listingSyncJobs!.unshift(listingJob);
  return { event, job: listingJob };
}

function renderTemplate(template: ListingTemplate, values: Record<string, string>) {
  const replace = (source: string) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), source);
  return { title: replace(template.titleFormat), description: replace(template.descriptionFormat) };
}

export function validateChannelDraft(draft: ChannelListingDraft) {
  return MarketplaceEngine.validateDraft(draft);
}

function productImagesFor(data: OperatingData, productId: string) {
  return (data.productImages || []).filter((image) => image.productId === productId).sort((a, b) => a.position - b.position);
}

function productImageUrls(data: OperatingData, productId: string) {
  const product = data.products.find((entry) => entry.id === productId);
  const recordUrls = productImagesFor(data, productId).map((image) => image.url);
  return [...new Set([...recordUrls, product?.image, ...(product?.images || [])].filter((url): url is string => Boolean(url)))];
}

function universalCategoryFor(data: OperatingData, productId: string, variantId: string, marketplace: ManagedMarketplace) {
  const product = data.products.find((entry) => entry.id === productId);
  const variant = data.variants.find((entry) => entry.id === variantId);
  if (!product || !variant) return null;
  const inspector = MarketplaceEngine.inspectDraft({ product, variant, physicalSku: variant.sku, quantity: 0, productImages: productImagesFor(data, productId), imageUrls: productImageUrls(data, productId) }, marketplace);
  return inspector.universalInput.identity.categoryId;
}

export function upsertMarketplaceAccountDefault(data: OperatingData, input: MarketplaceDefaultInput) {
  ensureListingsCollections(data);
  const account = data.marketplaceAccounts!.find((entry) => entry.id === input.marketplaceAccountId);
  if (!account) throw new Error("Marketplace account not found.");
  const time = now();
  const category = input.universalCategoryId || null;
  const existing = data.marketplaceAccountDefaults!.find((entry) => entry.marketplaceAccountId === input.marketplaceAccountId && entry.universalCategoryId === category && entry.fieldKey === input.fieldKey);
  if (existing) {
    existing.value = input.value;
    existing.enabled = input.enabled !== false;
    existing.updatedAt = time;
    existing.createdBy ||= input.actor;
    activity(data, "Marketplace default updated", "marketplace_account", account.id, `${account.marketplace} ${input.fieldKey} default saved.`);
    return existing;
  }
  const created: MarketplaceAccountDefault = { id: id(), workspaceId: "local", marketplaceAccountId: input.marketplaceAccountId, universalCategoryId: category, fieldKey: input.fieldKey, value: input.value, enabled: input.enabled !== false, createdBy: input.actor || "local-user", createdAt: time, updatedAt: time };
  data.marketplaceAccountDefaults!.unshift(created);
  activity(data, "Marketplace default created", "marketplace_account", account.id, `${account.marketplace} ${input.fieldKey} default saved.`);
  return created;
}

export function upsertProductMarketplaceOverride(data: OperatingData, input: ProductOverrideInput) {
  ensureListingsCollections(data);
  const product = data.products.find((entry) => entry.id === input.productId);
  if (!product) throw new Error("Product not found for marketplace override.");
  const time = now();
  const existing = data.productMarketplaceOverrides!.find((entry) => entry.productId === input.productId && entry.variantId === input.variantId && entry.marketplace === input.marketplace && entry.marketplaceAccountId === input.marketplaceAccountId && entry.fieldKey === input.fieldKey);
  if (existing) {
    existing.value = input.value;
    existing.updatedAt = time;
    existing.createdBy ||= input.actor;
    activity(data, "Product marketplace override updated", "product", product.id, `${product.title} ${input.marketplace} ${input.fieldKey} override saved.`);
    return existing;
  }
  const created: ProductMarketplaceOverride = { id: id(), marketplace: input.marketplace, marketplaceAccountId: input.marketplaceAccountId, productId: input.productId, variantId: input.variantId, fieldKey: input.fieldKey, value: input.value, createdBy: input.actor || "local-user", createdAt: time, updatedAt: time };
  data.productMarketplaceOverrides!.unshift(created);
  activity(data, "Product marketplace override created", "product", product.id, `${product.title} ${input.marketplace} ${input.fieldKey} override saved.`);
  return created;
}

function defaultForField(data: OperatingData, accountId: string | undefined, universalCategoryId: string | null, fieldKey: string) {
  if (!accountId) return undefined;
  const active = data.marketplaceAccountDefaults!.filter((entry) => entry.enabled && entry.marketplaceAccountId === accountId && entry.fieldKey === fieldKey);
  return active.find((entry) => entry.universalCategoryId === universalCategoryId) || active.find((entry) => entry.universalCategoryId === null);
}

function overridesFor(data: OperatingData, productId: string, variantId: string, marketplace: ManagedMarketplace, accountId?: string) {
  return data.productMarketplaceOverrides!.filter((entry) => entry.productId === productId && (!entry.variantId || entry.variantId === variantId) && entry.marketplace === marketplace && (!entry.marketplaceAccountId || entry.marketplaceAccountId === accountId));
}

function coerceOverrideMap(defaults: MarketplaceAccountDefault[], overrides: ProductMarketplaceOverride[]) {
  const map: Record<string, unknown> = {};
  for (const entry of defaults) map[entry.fieldKey] = entry.value;
  for (const entry of overrides) map[entry.fieldKey] = entry.value;
  return map;
}

export function inspectProductMarketplaceDraft(data: OperatingData, input: { variantId: string; marketplace: ManagedMarketplace }) {
  ensureListingsCollections(data);
  seedMarketplaceAccountsAndTemplates(data);
  const variant = data.variants.find((entry) => entry.id === input.variantId);
  if (!variant || !isActiveVariant(data, variant)) throw new Error("Active variant not found for marketplace inspection.");
  const product = data.products.find((entry) => entry.id === variant.productId);
  if (!product) throw new Error("Product not found for marketplace inspection.");
  const account = data.marketplaceAccounts!.find((entry) => entry.marketplace === input.marketplace);
  const universalCategoryId = universalCategoryFor(data, product.id, variant.id, input.marketplace);
  const defaults = account ? data.marketplaceAccountDefaults!.filter((entry) => entry.enabled && entry.marketplaceAccountId === account.id && (entry.universalCategoryId === null || entry.universalCategoryId === universalCategoryId)) : [];
  const overrides = overridesFor(data, product.id, variant.id, input.marketplace, account?.id);
  const balance = data.balances.find((entry) => entry.variantId === variant.id);
  const draft = MarketplaceEngine.inspectDraft({
    product,
    variant,
    physicalSku: variant.sku,
    quantity: balance ? availableUnits(balance) : 0,
    productImages: productImagesFor(data, product.id),
    imageUrls: productImageUrls(data, product.id),
    overrides: coerceOverrideMap(defaults, overrides),
  }, input.marketplace);
  const enrichedFields = draft.mappingSources.map((field) => {
    const accountDefault = defaultForField(data, account?.id, universalCategoryId, field.fieldKey);
    const productOverride = overrides.find((entry) => entry.fieldKey === field.fieldKey);
    if (productOverride) return { ...field, value: productOverride.value, source: "user_override" as const, sourcePath: "productMarketplaceOverrides", confidence: 1 };
    if (accountDefault) return { ...field, value: accountDefault.value, source: "marketplace_default" as const, sourcePath: accountDefault.universalCategoryId ? "categoryAccountDefault" : "accountDefault", confidence: 0.96 };
    return field;
  });
  return { ...draft, mappingSources: enrichedFields, defaultsApplied: enrichedFields.filter((field) => field.source === "marketplace_default"), overridesApplied: enrichedFields.filter((field) => field.source === "user_override") } satisfies MarketplaceDraftInspector;
}

function draftStatusToProductStatus(draft: ChannelListingDraft | undefined, inspector?: MarketplaceDraftInspector, queuedTask?: MarketplacePublishTask): ProductMarketplaceStatus {
  if (queuedTask) {
    if (["queued", "validating", "preparing_images"].includes(queuedTask.status)) return "queued";
    if (["uploading_images", "submitting", "confirming"].includes(queuedTask.status)) return "publishing";
    if (queuedTask.status === "failed") return "failed";
  }
  if (!draft) {
    if (!inspector) return "not_started";
    if (inspector.readinessResult.blockingIssues.length) return "blocked";
    if (inspector.readinessResult.state === "needs_information") return "needs_information";
    if (inspector.readinessResult.state === "needs_review") return "needs_review";
    return "ready";
  }
  if (draft.status === "validated") return inspector?.readinessResult.state === "ready" ? "ready" : "needs_review";
  if (draft.status === "manual_required") return "needs_review";
  if (draft.status === "draft") return "draft";
  if (draft.status === "queued") return "queued";
  if (draft.status === "published") return "published";
  if (draft.status === "failed") return "failed";
  if (draft.status === "paused") return "paused";
  if (draft.status === "sold") return "sold";
  if (draft.status === "delisted") return "ended";
  return "not_started";
}

export function buildListingsPublishingWorkspace(data: OperatingData) {
  ensureListingsCollections(data);
  seedMarketplaceAccountsAndTemplates(data);
  const products = data.products.filter((product) => product.status === "active" || product.status === "draft").map((product) => {
    const variants = data.variants.filter((variant) => variant.productId === product.id && isActiveVariant(data, variant));
    const primary = variants[0];
    const available = variants.reduce((total, variant) => total + availableUnits(data.balances.find((balance) => balance.variantId === variant.id) || { id: "", variantId: variant.id, onHand: 0, reserved: 0, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 }), 0);
    const statuses = primary ? crossListingChannels.map((marketplace) => {
      const draft = data.channelListingDrafts!.find((entry) => entry.variantId === primary.id && entry.marketplace === marketplace);
      const task = draft ? data.marketplacePublishTasks!.find((entry) => entry.draftId === draft.id && !["published", "cancelled"].includes(entry.status)) : undefined;
      const inspector = inspectProductMarketplaceDraft(data, { variantId: primary.id, marketplace });
      const blocking = inspector.readinessResult.blockingIssues[0]?.message || draft?.validationErrors[0];
      return { marketplace, status: draftStatusToProductStatus(draft, inspector, task), readinessScore: inspector.readinessResult.score, missingField: blocking || inspector.readinessResult.warnings[0]?.message || inspector.readinessResult.recommendations[0]?.message || "Ready to review", price: draft?.price || inspector.generatedOutput.price, lastSync: draft?.lastSyncAt || draft?.updatedAt || draft?.createdAt || null, draftId: draft?.id || null, publishMode: draft?.publishMode || inspector.generatedOutput.publishMode };
    }) : [];
    const lastActivity = statuses.map((entry) => entry.lastSync).filter((value): value is string => Boolean(value)).sort().at(-1) || product.updatedAt;
    return { productId: product.id, productName: product.title, coverImage: productImageUrls(data, product.id)[0] || product.image || "/brand/faust-snow-leopard.svg", sku: primary?.sku || "No active SKU", category: product.category, condition: primary?.condition || "Needs SKU", availableInventory: available, basePrice: primary?.defaultSalePrice || 0, marketplaceCoverage: statuses, mostImportantMissingField: statuses.find((entry) => ["blocked", "needs_information", "needs_review", "failed"].includes(entry.status))?.missingField || "Ready to publish", lastListingActivity: lastActivity, readyMarketplaces: statuses.filter((entry) => ["ready", "published"].includes(entry.status)).length };
  });
  const tasks = data.marketplacePublishTasks!.map((task) => {
    const draft = data.channelListingDrafts!.find((entry) => entry.id === task.draftId);
    const variant = draft ? data.variants.find((entry) => entry.id === draft.variantId) : undefined;
    const product = variant ? data.products.find((entry) => entry.id === variant.productId) : undefined;
    const account = data.marketplaceAccounts!.find((entry) => entry.id === task.marketplaceAccountId);
    return { ...task, marketplace: draft?.marketplace || account?.marketplace || "Depop", productName: product?.title || "Unknown product", sku: variant?.sku || draft?.physicalSku || "Unknown SKU", accountName: account?.displayName || "Marketplace account" };
  });
  return {
    overview: {
      readyToPublish: products.filter((product) => product.marketplaceCoverage.some((entry) => entry.status === "ready")).length,
      needingInformation: products.filter((product) => product.marketplaceCoverage.some((entry) => ["blocked", "needs_information", "needs_review"].includes(entry.status))).length,
      draftListings: data.channelListingDrafts!.filter((draft) => ["draft", "validated", "manual_required"].includes(draft.status)).length,
      currentlyPublishing: data.marketplacePublishTasks!.filter((task) => ["queued", "validating", "preparing_images", "uploading_images", "submitting", "confirming"].includes(task.status)).length,
      recentlyPublished: data.channelListingDrafts!.filter((draft) => draft.status === "published").length,
      failedPublishes: data.marketplacePublishTasks!.filter((task) => task.status === "failed").length + data.channelListingDrafts!.filter((draft) => draft.status === "failed").length,
      coverageGaps: products.filter((product) => product.marketplaceCoverage.some((entry) => entry.status === "not_started")).length,
    },
    products,
    publishingQueue: data.crossListingJobs!.map((job) => ({ ...job, productName: data.products.find((product) => product.id === job.productId)?.title || "Unknown product", tasks: tasks.filter((task) => task.crossListingJobId === job.id) })),
    publishedListings: data.channelListingDrafts!.filter((draft) => draft.status === "published").map((draft) => {
      const variant = data.variants.find((entry) => entry.id === draft.variantId);
      const product = variant ? data.products.find((entry) => entry.id === variant.productId) : undefined;
      return { draft, productName: product?.title || "Unknown product", sku: variant?.sku || draft.physicalSku, listingHealth: draft.syncState === "clean" ? "Healthy" : draft.syncState === "failed" ? "Failed" : draft.syncState === "risk_locked" ? "At Risk" : "Needs Review" };
    }),
    accounts: data.marketplaceAccounts!,
    defaults: data.marketplaceAccountDefaults!,
    overrides: data.productMarketplaceOverrides!,
    syncReviews: data.productListingSyncReviews!,
  };
}

export function createFiveChannelDrafts(data: OperatingData, input: CreateCrossListingInput) {
  ensureListingsCollections(data);
  seedMarketplaceAccountsAndTemplates(data);
  if (input.idempotencyKey && data.channelListingDrafts!.some((draft) => draft.idempotencyKey === input.idempotencyKey)) return data;
  const variant = data.variants.find((entry) => entry.id === input.variantId);
  if (!variant || !isActiveVariant(data, variant)) throw new Error("Active variant not found for cross-listing.");
  const product = data.products.find((entry) => entry.id === variant.productId);
  const balance = data.balances.find((entry) => entry.variantId === variant.id);
  const quantity = Math.max(balance ? availableUnits(balance) : 0, 0);
  const physicalSku = input.physicalSku || variant.sku;
  for (const marketplace of crossListingChannels) {
    const account = data.marketplaceAccounts!.find((entry) => entry.marketplace === marketplace);
    const template = data.listingTemplates!.find((entry) => entry.marketplace === marketplace)!;
    const draftPlan = MarketplaceEngine.generateDraft({
      product: product || { id: variant.productId, title: variant.title, category: "Clothing", tags: [], status: "active", createdAt: now(), updatedAt: now() },
      variant,
      physicalSku,
      quantity,
      basePrice: input.basePrice,
      imageUrls: input.imageUrls,
    }, marketplace);
    const rendered = renderTemplate(template, { title: draftPlan.title, sku: variant.sku, physicalSku, condition: draftPlan.attributes.condition || variant.condition });
    rendered.title = draftPlan.title;
    rendered.description = draftPlan.description || rendered.description;
    const existingDraft = data.channelListingDrafts!.find((draft) => draft.variantId === variant.id && draft.marketplace === marketplace);
    if (existingDraft) {
      existingDraft.title = rendered.title;
      existingDraft.description ||= rendered.description;
      existingDraft.category = draftPlan.category;
      existingDraft.attributes = { ...draftPlan.attributes, ...existingDraft.attributes };
      existingDraft.publishMode = draftPlan.publishMode;
      existingDraft.imageUrls = existingDraft.imageUrls.length ? existingDraft.imageUrls.slice(0, getMarketplaceProfile(marketplace).imageRules.maxImages) : draftPlan.imageUrls;
      existingDraft.validationErrors = validateChannelDraft(existingDraft);
      if (existingDraft.validationErrors.length) {
        existingDraft.status = "failed";
        existingDraft.syncState = "failed";
        review(data, { channelDraftId: existingDraft.id, marketplace, severity: "warning", reason: "validation_error", detail: existingDraft.validationErrors.join(" ") });
      } else if (existingDraft.status === "failed") {
        existingDraft.status = "validated";
        existingDraft.syncState = "pending";
        data.listingReviewItems!.filter((entry) => entry.channelDraftId === existingDraft.id && entry.reason === "validation_error" && entry.status === "open").forEach((entry) => { entry.status = "resolved"; entry.resolvedAt = now(); });
      }
      existingDraft.updatedAt = now();
      continue;
    }
    const price = draftPlan.price;
    const listing: Listing = { id: id(), variantId: variant.id, marketplace, title: rendered.title, price, quantity, status: "draft", syncState: "manual", createdAt: now() };
    const mapping: PhysicalSkuMapping = { id: id(), variantId: variant.id, physicalSku, channelListingId: listing.id, channel: marketplace, externalSku: physicalSku, status: "active", confidence: 1, createdAt: now() };
    const draft: ChannelListingDraft = { id: id(), listingId: listing.id, variantId: variant.id, physicalSku, marketplace, accountId: account?.id, templateId: template.id, title: rendered.title, description: rendered.description, price, category: draftPlan.category, attributes: draftPlan.attributes, imageUrls: draftPlan.imageUrls, quantity, status: "draft", validationErrors: [], publishMode: draftPlan.publishMode, syncState: "pending", idempotencyKey: input.idempotencyKey, createdAt: now() };
    draft.validationErrors = validateChannelDraft(draft);
    draft.status = draft.validationErrors.length ? "failed" : "validated";
    data.listings.push(listing);
    data.physicalSkuMappings!.push(mapping);
    data.channelListingDrafts!.push(draft);
    addOutboxJob(data, "listing.publish_requested", draft, "publish", { draftId: draft.id, marketplace, physicalSku }, input.idempotencyKey);
    if (draft.publishMode !== "adapter") review(data, { channelDraftId: draft.id, marketplace, severity: "info", reason: "manual_publish_required", detail: `${marketplace} uses ${draft.publishMode === "extension" ? "extension-assisted" : "manual"} publishing until live credentials are connected.`, actionLabel: "Open manual workflow" });
    if (draft.validationErrors.length) review(data, { channelDraftId: draft.id, marketplace, severity: "warning", reason: "validation_error", detail: draft.validationErrors.join(" ") });
    for (const warning of draftPlan.warnings) review(data, { channelDraftId: draft.id, marketplace, severity: "info", reason: "validation_error", detail: warning });
  }
  activity(data, "Five channel drafts created", "variant", variant.id, `${physicalSku} generated drafts for Depop, eBay, Etsy, Mercari, and Poshmark.`);
  return data;
}

function applyInspectorValuesToDraft(draft: ChannelListingDraft, inspector: MarketplaceDraftInspector) {
  for (const field of inspector.mappingSources) {
    if (field.fieldKey === "title" && typeof field.value === "string") draft.title = field.value;
    if (field.fieldKey === "description" && typeof field.value === "string") draft.description = field.value;
    if (field.fieldKey === "price" && typeof field.value === "number") draft.price = Math.round(field.value * 100) / 100;
    if (field.fieldKey === "category" && typeof field.value === "string") draft.category = field.value;
    if (field.fieldKey === "images" && Array.isArray(field.value)) draft.imageUrls = field.value.filter((url): url is string => typeof url === "string");
    if (!["title", "description", "price", "category", "images"].includes(field.fieldKey) && typeof field.value !== "object") draft.attributes[field.fieldKey] = String(field.value);
  }
  draft.validationErrors = [...inspector.validationResults, ...inspector.readinessResult.blockingIssues.map((issue) => issue.message)];
  draft.updatedAt = now();
}

export function createCrossListingPublishJob(data: OperatingData, input: CrossListingPublishInput) {
  ensureListingsCollections(data);
  seedMarketplaceAccountsAndTemplates(data);
  if (input.idempotencyKey) {
    const existing = data.crossListingJobs!.find((job) => job.idempotencyKey === input.idempotencyKey);
    if (existing) return data;
  }
  const product = data.products.find((entry) => entry.id === input.productId);
  if (!product) throw new Error("Product not found for cross-listing publish.");
  const variant = data.variants.find((entry) => entry.productId === product.id && isActiveVariant(data, entry));
  if (!variant) throw new Error("Product needs an active SKU before publishing.");
  createFiveChannelDrafts(data, { variantId: variant.id, imageUrls: productImageUrls(data, product.id), idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey.slice(0, 18)}00000000000000` : undefined });
  const marketplaces = input.marketplaces?.length ? input.marketplaces : [...crossListingChannels];
  const time = now();
  const job: CrossListingJob = { id: id(), workspaceId: "local", productId: product.id, initiatedBy: input.initiatedBy || "local-user", status: "running", marketplaceCount: marketplaces.length, completedCount: 0, failedCount: 0, idempotencyKey: input.idempotencyKey, inventoryStrategy: input.inventoryStrategy || "shared", createdAt: time, startedAt: time, completedAt: null, updatedAt: time };
  data.crossListingJobs!.unshift(job);
  for (const marketplace of marketplaces) {
    const account = data.marketplaceAccounts!.find((entry) => entry.marketplace === marketplace);
    const draft = data.channelListingDrafts!.find((entry) => entry.variantId === variant.id && entry.marketplace === marketplace);
    if (!account || !draft) continue;
    const taskKey = `publish:${product.id}:${account.id}:${draft.id}:${draft.updatedAt || draft.createdAt}`;
    const duplicateTask = data.marketplacePublishTasks!.find((task) => task.idempotencyKey === taskKey || (task.draftId === draft.id && ["queued", "validating", "preparing_images", "uploading_images", "submitting", "confirming", "published"].includes(task.status)));
    if (duplicateTask) continue;
    const inspector = inspectProductMarketplaceDraft(data, { variantId: variant.id, marketplace });
    applyInspectorValuesToDraft(draft, inspector);
    const riskLock = data.inventoryRiskLocks!.find((lock) => lock.status === "active" && (lock.variantId === variant.id || lock.listingId === draft.listingId));
    const task: MarketplacePublishTask = { id: id(), crossListingJobId: job.id, marketplaceAccountId: account.id, draftId: draft.id, status: "queued", attemptCount: 1, marketplaceListingId: null, failureCode: null, failureMessage: null, retryable: false, idempotencyKey: taskKey, startedAt: time, completedAt: null, createdAt: time, updatedAt: time };
    if (riskLock) {
      task.status = "failed"; task.failureCode = "risk_lock"; task.failureMessage = `Publishing prevented by active ${riskLock.reason.replaceAll("_", " ")} risk lock.`; task.completedAt = time; draft.status = "failed"; draft.syncState = "risk_locked"; draft.riskLockId = riskLock.id; job.failedCount += 1;
      review(data, { channelDraftId: draft.id, marketplace, severity: "critical", reason: "risk_lock", detail: task.failureMessage });
    } else if (draft.validationErrors.length || inspector.readinessResult.blockingIssues.length) {
      task.status = "failed"; task.failureCode = "validation_rejected"; task.failureMessage = draft.validationErrors[0] || inspector.readinessResult.blockingIssues[0]?.message || "Marketplace readiness blocked publishing."; task.completedAt = time; draft.status = "failed"; draft.syncState = "failed"; job.failedCount += 1;
      review(data, { channelDraftId: draft.id, marketplace, severity: "warning", reason: "validation_error", detail: task.failureMessage });
    } else if (draft.publishMode === "adapter") {
      task.status = "published"; task.marketplaceListingId = `${providerId(marketplace).toUpperCase()}-${draft.id.slice(0, 8)}`; task.completedAt = time; draft.status = "published"; draft.syncState = "clean"; draft.externalListingId = task.marketplaceListingId; draft.externalUrl = `https://example.test/${providerId(marketplace)}/${task.marketplaceListingId}`; draft.lastSyncAt = time; job.completedCount += 1;
      const listing = data.listings.find((entry) => entry.id === draft.listingId);
      if (listing) { listing.status = "active"; listing.syncState = "connected"; listing.marketplaceUrl = draft.externalUrl; }
    } else {
      task.status = "queued"; task.retryable = true; task.failureCode = null; task.failureMessage = `${marketplace} is ready for guided ${draft.publishMode === "extension" ? "extension" : "manual"} publishing.`; draft.status = "queued"; draft.syncState = "manual";
    }
    data.marketplacePublishTasks!.unshift(task);
  }
  job.status = job.failedCount && job.completedCount ? "partially_completed" : job.failedCount === job.marketplaceCount ? "failed" : job.completedCount === job.marketplaceCount ? "completed" : "queued";
  job.completedAt = ["completed", "failed", "partially_completed"].includes(job.status) ? now() : null;
  job.updatedAt = now();
  activity(data, "Cross-listing publish reviewed", "product", product.id, `${product.title} queued ${marketplaces.length} marketplace publishing task(s) with ${job.completedCount} published and ${job.failedCount} blocked.`);
  return data;
}

export function retryMarketplacePublishTask(data: OperatingData, input: { taskId: string; idempotencyKey?: string }) {
  ensureListingsCollections(data);
  const task = data.marketplacePublishTasks!.find((entry) => entry.id === input.taskId);
  if (!task) throw new Error("Marketplace publish task not found.");
  if (task.status !== "failed" && task.status !== "retry_wait") return data;
  if (!task.retryable && task.failureCode && !["marketplace_unavailable", "network_timeout", "rate_limited", "unknown_connector_response"].includes(task.failureCode)) throw new Error("This marketplace failure needs review before retry.");
  const draft = data.channelListingDrafts!.find((entry) => entry.id === task.draftId);
  if (!draft) throw new Error("Draft for retry not found.");
  task.attemptCount += 1;
  task.status = draft.publishMode === "adapter" ? "published" : "queued";
  task.failureCode = null;
  task.failureMessage = null;
  task.retryable = draft.publishMode !== "adapter";
  task.updatedAt = now();
  if (draft.publishMode === "adapter") {
    task.marketplaceListingId = task.marketplaceListingId || `${providerId(draft.marketplace).toUpperCase()}-${draft.id.slice(0, 8)}`;
    task.completedAt = now();
    draft.status = "published";
    draft.syncState = "clean";
    draft.externalListingId = task.marketplaceListingId;
    draft.externalUrl = draft.externalUrl || `https://example.test/${providerId(draft.marketplace)}/${task.marketplaceListingId}`;
    draft.lastSyncAt = now();
  } else {
    draft.status = "queued";
    draft.syncState = "manual";
  }
  data.listingReviewItems!.filter((entry) => entry.channelDraftId === draft.id && entry.status === "open").forEach((entry) => { entry.status = "resolved"; entry.resolvedAt = now(); });
  activity(data, "Marketplace publish retried", "marketplace_publish_task", task.id, `${draft.marketplace} retry attempt ${task.attemptCount}.`);
  return data;
}

export function createProductListingSyncReview(data: OperatingData, input: { productId: string; fieldKey: string; previousValue: string; suggestedValue: string; marketplaces?: ManagedMarketplace[] }) {
  ensureListingsCollections(data);
  const product = data.products.find((entry) => entry.id === input.productId);
  if (!product) throw new Error("Product not found for listing sync review.");
  const variants = data.variants.filter((entry) => entry.productId === product.id);
  const marketplaces = input.marketplaces?.length ? input.marketplaces : [...crossListingChannels];
  for (const marketplace of marketplaces) {
    const draft = data.channelListingDrafts!.find((entry) => variants.some((variant) => variant.id === entry.variantId) && entry.marketplace === marketplace);
    data.productListingSyncReviews!.unshift({ id: id(), productId: product.id, marketplace, draftId: draft?.id, fieldKey: input.fieldKey, previousValue: input.previousValue, suggestedValue: input.suggestedValue, status: "open", createdAt: now(), updatedAt: now() });
  }
  activity(data, "Listing sync review created", "product", product.id, `${input.fieldKey} changed from ${input.previousValue} to ${input.suggestedValue}.`);
  return data;
}

export async function publishChannelDraft(data: OperatingData, input: ListingActionInput) {
  ensureListingsCollections(data);
  const draft = data.channelListingDrafts!.find((entry) => entry.id === input.draftId);
  if (!draft) throw new Error("Channel listing draft not found.");
  draft.validationErrors = validateChannelDraft(draft);
  if (draft.validationErrors.length) { draft.status = "failed"; draft.syncState = "failed"; review(data, { channelDraftId: draft.id, marketplace: draft.marketplace, severity: "warning", reason: "validation_error", detail: draft.validationErrors.join(" ") }); return data; }
  if (draft.publishMode !== "adapter") { draft.status = "manual_required"; draft.syncState = "manual"; review(data, { channelDraftId: draft.id, marketplace: draft.marketplace, severity: "info", reason: "manual_publish_required", detail: "Use the extension-assisted workflow, then confirm external ID and URL." }); return data; }
  const result = await getMarketplaceAdapter(providerId(draft.marketplace)).publish({ listingId: draft.id, title: draft.title, description: draft.description, price: draft.price, quantity: draft.quantity, imageUrls: draft.imageUrls, category: draft.category, condition: draft.attributes.condition });
  draft.status = "published"; draft.syncState = "clean"; draft.externalListingId = result.externalId; draft.externalUrl = result.externalUrl; draft.lastSyncAt = now(); draft.updatedAt = now();
  const listing = data.listings.find((entry) => entry.id === draft.listingId); if (listing) { listing.status = "active"; listing.syncState = "connected"; listing.marketplaceUrl = result.externalUrl; }
  const mapping = data.physicalSkuMappings!.find((entry) => entry.channelListingId === draft.listingId); if (mapping) { mapping.externalListingId = result.externalId; mapping.updatedAt = now(); }
  data.listingReviewItems!.filter((entry) => entry.channelDraftId === draft.id && entry.status === "open").forEach((entry) => { entry.status = "resolved"; entry.resolvedAt = now(); });
  activity(data, "Channel listing published", "channel_listing_draft", draft.id, `${draft.marketplace} published ${result.externalId}.`);
  return data;
}

export function confirmExternalListing(data: OperatingData, input: ListingActionInput) {
  ensureListingsCollections(data);
  const draft = data.channelListingDrafts!.find((entry) => entry.id === input.draftId);
  if (!draft) throw new Error("Channel listing draft not found.");
  if (!input.externalListingId || !input.externalUrl) throw new Error("External listing ID and URL are required.");
  draft.externalListingId = input.externalListingId; draft.externalUrl = input.externalUrl; draft.status = "published"; draft.syncState = "clean"; draft.lastSyncAt = now(); draft.updatedAt = now();
  const listing = data.listings.find((entry) => entry.id === draft.listingId); if (listing) { listing.status = "active"; listing.marketplaceUrl = input.externalUrl; listing.syncState = "manual"; }
  const mapping = data.physicalSkuMappings!.find((entry) => entry.channelListingId === draft.listingId); if (mapping) { mapping.externalListingId = input.externalListingId; mapping.externalListingId = input.externalListingId; mapping.updatedAt = now(); }
  data.listingReviewItems!.filter((entry) => entry.channelDraftId === draft.id && entry.status === "open").forEach((entry) => { entry.status = "resolved"; entry.resolvedAt = now(); });
  activity(data, "External listing confirmed", "channel_listing_draft", draft.id, input.externalListingId);
  return data;
}

export function syncDraftQuantity(data: OperatingData, input: ListingActionInput) {
  ensureListingsCollections(data);
  const draft = data.channelListingDrafts!.find((entry) => entry.id === input.draftId);
  if (!draft) throw new Error("Channel listing draft not found.");
  const balance = data.balances.find((entry) => entry.variantId === draft.variantId);
  const usable = balance ? availableUnits(balance) : 0;
  const quantity = input.quantity ?? Math.max(usable, 0);
  draft.quantity = quantity;
  draft.syncState = usable < quantity ? "risk_locked" : "pending";
  draft.updatedAt = now();
  data.channelSyncStates = [{ id: data.channelSyncStates!.find((entry) => entry.listingId === draft.listingId)?.id || id(), channel: draft.marketplace, listingId: draft.listingId, variantId: draft.variantId, physicalSku: draft.physicalSku, desiredQuantity: quantity, lastSyncedQuantity: usable >= quantity ? quantity : undefined, status: usable >= quantity ? "pending" : "blocked", risk: usable >= quantity ? "none" : "oversell", nextSyncAt: now(), updatedAt: now() }, ...data.channelSyncStates!.filter((entry) => entry.listingId !== draft.listingId)];
  if (usable < quantity) {
    const lock = { id: id(), variantId: draft.variantId, listingId: draft.listingId, channel: draft.marketplace, reason: "oversell_risk" as const, status: "active" as const, lockedQuantity: quantity - usable, createdAt: now(), notes: `Listing wants ${quantity}; usable stock is ${usable}.` };
    data.inventoryRiskLocks!.unshift(lock); draft.riskLockId = lock.id;
    review(data, { channelDraftId: draft.id, marketplace: draft.marketplace, severity: "critical", reason: "risk_lock", detail: lock.notes || "Oversell risk lock created." });
  }
  addOutboxJob(data, "listing.quantity_sync_requested", draft, "sync_quantity", { draftId: draft.id, quantity, usable }, input.idempotencyKey);
  activity(data, "Listing quantity sync queued", "channel_listing_draft", draft.id, `${draft.marketplace} quantity ${quantity}.`);
  return data;
}

export function pauseOrDelistDraft(data: OperatingData, input: ListingActionInput & { mode: "pause" | "delist" }) {
  ensureListingsCollections(data);
  const draft = data.channelListingDrafts!.find((entry) => entry.id === input.draftId);
  if (!draft) throw new Error("Channel listing draft not found.");
  draft.status = input.mode === "pause" ? "paused" : "delisted"; draft.syncState = draft.publishMode === "adapter" ? "pending" : "manual"; draft.updatedAt = now();
  const listing = data.listings.find((entry) => entry.id === draft.listingId); if (listing) listing.status = input.mode === "pause" ? "paused" : "paused";
  addOutboxJob(data, "listing.delist_requested", draft, input.mode === "pause" ? "pause" : "delist", { draftId: draft.id, mode: input.mode, reason: input.reason }, input.idempotencyKey);
  if (draft.publishMode !== "adapter") review(data, { channelDraftId: draft.id, marketplace: draft.marketplace, severity: "warning", reason: "manual_publish_required", detail: `Manually ${input.mode} this listing on ${draft.marketplace}, then confirm.` });
  activity(data, `Listing ${input.mode} requested`, "channel_listing_draft", draft.id, input.reason || input.mode);
  return data;
}

export function coordinateSoldItem(data: OperatingData, input: ListingActionInput) {
  ensureListingsCollections(data);
  const sold = data.channelListingDrafts!.find((entry) => entry.id === input.draftId);
  if (!sold) throw new Error("Sold channel listing draft not found.");
  sold.status = "sold"; sold.quantity = 0; sold.syncState = "clean"; sold.updatedAt = now();
  for (const sibling of data.channelListingDrafts!.filter((draft) => draft.variantId === sold.variantId && draft.id !== sold.id && !["delisted", "sold"].includes(draft.status))) {
    sibling.status = "delisted"; sibling.quantity = 0; sibling.syncState = sibling.publishMode === "adapter" ? "pending" : "manual"; sibling.updatedAt = now();
    addOutboxJob(data, "listing.sold_coordination_requested", sibling, "sold_coordination", { soldDraftId: sold.id, siblingDraftId: sibling.id }, input.idempotencyKey);
    if (sibling.publishMode !== "adapter") review(data, { channelDraftId: sibling.id, marketplace: sibling.marketplace, severity: "critical", reason: "sold_coordination", detail: `${sold.marketplace} sold. Delist sibling ${sibling.marketplace} listing manually or through the extension.` });
  }
  activity(data, "Sold item coordinated", "channel_listing_draft", sold.id, `${sold.marketplace} sold; sibling channels queued for delist.`);
  return data;
}

export function retryFailedListingSync(data: OperatingData, input: ListingActionInput) {
  ensureListingsCollections(data);
  const draft = data.channelListingDrafts!.find((entry) => entry.id === input.draftId);
  if (!draft) throw new Error("Channel listing draft not found.");
  draft.syncState = "pending"; draft.status = draft.status === "failed" ? "queued" : draft.status; draft.updatedAt = now();
  data.listingSyncJobs!.filter((job) => job.channelDraftId === draft.id && ["failed", "dead_lettered"].includes(job.status)).forEach((job) => { job.status = "queued"; job.attempts = 0; job.error = undefined; job.updatedAt = now(); });
  data.listingReviewItems!.filter((entry) => entry.channelDraftId === draft.id && entry.status === "open").forEach((entry) => { entry.status = "resolved"; entry.resolvedAt = now(); });
  addOutboxJob(data, "listing.publish_requested", draft, "retry", { draftId: draft.id }, input.idempotencyKey);
  activity(data, "Listing sync retried", "channel_listing_draft", draft.id, draft.marketplace);
  return data;
}

export function listingsSummary(data: OperatingData) {
  ensureListingsCollections(data);
  return {
    drafts: data.channelListingDrafts!.length,
    published: data.channelListingDrafts!.filter((draft) => draft.status === "published").length,
    manualRequired: data.channelListingDrafts!.filter((draft) => draft.status === "manual_required").length,
    failed: data.channelListingDrafts!.filter((draft) => draft.status === "failed").length,
    openReviews: data.listingReviewItems!.filter((item) => item.status === "open").length,
    queuedJobs: data.listingSyncJobs!.filter((job) => job.status === "queued" || job.status === "manual_required").length,
    riskLocks: data.inventoryRiskLocks!.filter((lock) => lock.status === "active").length,
  };
}
