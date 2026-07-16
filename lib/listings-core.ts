import type { ChannelListingDraft, DurableJob, Listing, ListingReviewItem, ListingSyncJob, ListingTemplate, Marketplace, OperatingData, PhysicalSkuMapping, TransactionalOutboxEvent } from "@/domain/business";
import { availableUnits } from "./business-calculations";
import { getMarketplaceAdapter } from "../services/adapters/marketplace";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
export const crossListingChannels = ["Depop", "eBay", "Etsy", "Mercari", "Poshmark"] as const;
type Channel = typeof crossListingChannels[number];
const supportsApiPublish = (marketplace: Channel) => ["Depop", "eBay"].includes(marketplace);
const supportsExtension = (marketplace: Channel) => ["Etsy", "Mercari", "Poshmark"].includes(marketplace);
const providerId = (marketplace: Marketplace) => marketplace === "eBay" ? "ebay" : marketplace.toLowerCase();

export type CreateCrossListingInput = { variantId: string; physicalSku?: string; basePrice?: number; imageUrls?: string[]; idempotencyKey?: string };
export type ListingActionInput = { draftId: string; idempotencyKey?: string; externalListingId?: string; externalUrl?: string; quantity?: number; reason?: string };

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
}

export function seedMarketplaceAccountsAndTemplates(data: OperatingData) {
  ensureListingsCollections(data);
  for (const marketplace of crossListingChannels) {
    if (!data.marketplaceAccounts!.some((account) => account.marketplace === marketplace)) {
      data.marketplaceAccounts!.push({ id: id(), marketplace, displayName: `${marketplace} default`, status: supportsApiPublish(marketplace) ? "adapter_ready" : "extension_assisted", supportsApiPublish: supportsApiPublish(marketplace), supportsExtension: supportsExtension(marketplace), createdAt: now() });
    }
    if (!data.listingTemplates!.some((template) => template.marketplace === marketplace)) {
      data.listingTemplates!.push({ id: id(), name: `${marketplace} streetwear template`, marketplace, category: marketplace === "Etsy" ? "Clothing" : "Menswear", titleFormat: "{title} - {sku}", descriptionFormat: "{title}\n\nCondition: {condition}\nPhysical SKU: {physicalSku}\nShips from Faust OS inventory.", priceAdjustmentPercent: marketplace === "Poshmark" ? 12 : marketplace === "eBay" ? 8 : 0, defaultAttributes: { brand: "Unbranded", style: "Streetwear", condition: "New with tags" }, imagePolicy: marketplace === "Poshmark" ? "square_crop" : "all", shippingProfile: "Standard seller-paid shipping", createdAt: now() });
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
  const event: TransactionalOutboxEvent = { id: id(), topic, aggregateType: "channel_listing_draft", aggregateId: draft.id, payload, status: "pending", attempts: 0, idempotencyKey, createdAt: now() };
  const job: DurableJob = { id: id(), queue: topic.includes("quantity") || topic.includes("sold") ? "channel_sync" : "marketplace_publish", eventId: event.id, status: "queued", attempts: 0, maxAttempts: 3, payload, runAfter: now(), createdAt: now() };
  const listingJob: ListingSyncJob = { id: id(), channelDraftId: draft.id, marketplace: draft.marketplace, action, status: action === "publish" && draft.publishMode !== "adapter" ? "manual_required" : "queued", attempts: 0, maxAttempts: 3, idempotencyKey, runAfter: now(), createdAt: now() };
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
  const errors: string[] = [];
  if (!draft.title.trim()) errors.push("Title is required.");
  if (draft.title.length > 80 && ["Depop", "Poshmark"].includes(draft.marketplace)) errors.push(`${draft.marketplace} title must be 80 characters or fewer.`);
  if (draft.description.trim().length < 20) errors.push("Description must include condition and shipping detail.");
  if (draft.price <= 0) errors.push("Price must be greater than zero.");
  if (!draft.category) errors.push("Category is required.");
  if (!draft.imageUrls.length) errors.push("At least one image is required.");
  if (!draft.physicalSku) errors.push("Physical SKU mapping is required.");
  return errors;
}

export function createFiveChannelDrafts(data: OperatingData, input: CreateCrossListingInput) {
  ensureListingsCollections(data);
  seedMarketplaceAccountsAndTemplates(data);
  if (input.idempotencyKey && data.channelListingDrafts!.some((draft) => draft.idempotencyKey === input.idempotencyKey)) return data;
  const variant = data.variants.find((entry) => entry.id === input.variantId);
  if (!variant) throw new Error("Variant not found for cross-listing.");
  const product = data.products.find((entry) => entry.id === variant.productId);
  const balance = data.balances.find((entry) => entry.variantId === variant.id);
  const quantity = Math.max(balance ? availableUnits(balance) : 0, 0);
  const physicalSku = input.physicalSku || variant.sku;
  for (const marketplace of crossListingChannels) {
    if (data.channelListingDrafts!.some((draft) => draft.variantId === variant.id && draft.marketplace === marketplace)) continue;
    const account = data.marketplaceAccounts!.find((entry) => entry.marketplace === marketplace);
    const template = data.listingTemplates!.find((entry) => entry.marketplace === marketplace)!;
    const rendered = renderTemplate(template, { title: product?.title || variant.title, sku: variant.sku, physicalSku, condition: variant.condition });
    const price = Math.round((input.basePrice ?? variant.defaultSalePrice) * (1 + template.priceAdjustmentPercent / 100) * 100) / 100;
    const listing: Listing = { id: id(), variantId: variant.id, marketplace, title: rendered.title, price, quantity, status: "draft", syncState: "manual", createdAt: now() };
    const mapping: PhysicalSkuMapping = { id: id(), variantId: variant.id, physicalSku, channelListingId: listing.id, channel: marketplace, externalSku: physicalSku, status: "active", confidence: 1, createdAt: now() };
    const draft: ChannelListingDraft = { id: id(), listingId: listing.id, variantId: variant.id, physicalSku, marketplace, accountId: account?.id, templateId: template.id, title: rendered.title, description: rendered.description, price, category: template.category, attributes: template.defaultAttributes, imageUrls: input.imageUrls?.length ? input.imageUrls : [product?.image || "/placeholder-product.png"], quantity, status: "draft", validationErrors: [], publishMode: supportsApiPublish(marketplace) ? "adapter" : supportsExtension(marketplace) ? "extension" : "manual", syncState: "pending", idempotencyKey: input.idempotencyKey, createdAt: now() };
    draft.validationErrors = validateChannelDraft(draft);
    draft.status = draft.validationErrors.length ? "failed" : "validated";
    data.listings.push(listing);
    data.physicalSkuMappings!.push(mapping);
    data.channelListingDrafts!.push(draft);
    addOutboxJob(data, "listing.publish_requested", draft, "publish", { draftId: draft.id, marketplace, physicalSku }, input.idempotencyKey);
    if (draft.publishMode !== "adapter") review(data, { channelDraftId: draft.id, marketplace, severity: "info", reason: "manual_publish_required", detail: `${marketplace} requires extension/manual publishing until live credentials are connected.`, actionLabel: "Open manual workflow" });
    if (draft.validationErrors.length) review(data, { channelDraftId: draft.id, marketplace, severity: "warning", reason: "validation_error", detail: draft.validationErrors.join(" ") });
  }
  activity(data, "Five channel drafts created", "variant", variant.id, `${physicalSku} generated drafts for Depop, eBay, Etsy, Mercari, and Poshmark.`);
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
