import type { OperatingData, Product, Variant } from "@/domain/business";

export type ProductDeleteDependencySummary = {
  productId: string;
  variantIds: string[];
  imageCount: number;
  digitalTwinCount: number;
  listingCount: number;
  channelDraftCount: number;
  inventoryBalanceCount: number;
  stockMovementCount: number;
  purchaseReferenceCount: number;
  orderReferenceCount: number;
  lotReferenceCount: number;
  activeListingCount: number;
  generatedRecordCount: number;
  shouldArchive: boolean;
  reason: "no_operating_history" | "has_operating_history";
};

function hasQuantity(balance: OperatingData["balances"][number]) {
  return Boolean(balance.onHand || balance.reserved || balance.incoming || balance.damaged || balance.returned || balance.lost || balance.quarantined);
}

export function productDeleteDependencySummary(data: OperatingData, product: Product): ProductDeleteDependencySummary {
  const variantIds = data.variants.filter((entry) => entry.productId === product.id).map((entry) => entry.id);
  const variantIdSet = new Set(variantIds);
  const draftIds = new Set((data.channelListingDrafts || []).filter((entry) => variantIdSet.has(entry.variantId)).map((entry) => entry.id));
  const orderReferenceCount = data.orders.reduce((count, order) => count + order.items.filter((item) => variantIdSet.has(item.variantId)).length, 0);
  const purchaseReferenceCount = data.purchaseOrders.reduce((count, order) => count + order.items.filter((item) => variantIdSet.has(item.variantId)).length, 0)
    + data.parcels.reduce((count, parcel) => count + parcel.items.filter((item) => variantIdSet.has(item.variantId)).length, 0);
  const stockMovementCount = data.stockMovements.filter((movement) => variantIdSet.has(movement.variantId)).length;
  const inventoryBalanceCount = data.balances.filter((balance) => variantIdSet.has(balance.variantId)).length;
  const inventoryBalanceWithQuantityCount = data.balances.filter((balance) => variantIdSet.has(balance.variantId) && hasQuantity(balance)).length;
  const lotReferenceCount = (data.inventoryLots || []).filter((lot) => variantIdSet.has(lot.variantId)).length
    + (data.orderItemCostAllocations || []).filter((allocation) => variantIdSet.has(allocation.variantId)).length;
  const activeListingCount = data.listings.filter((listing) => variantIdSet.has(listing.variantId) && ["active", "sold"].includes(listing.status)).length
    + (data.channelListingDrafts || []).filter((draft) => variantIdSet.has(draft.variantId) && Boolean(draft.externalListingId)).length;
  const shouldArchive = Boolean(orderReferenceCount || purchaseReferenceCount || stockMovementCount || inventoryBalanceWithQuantityCount || lotReferenceCount || activeListingCount);

  return {
    productId: product.id,
    variantIds,
    imageCount: (data.productImages || []).filter((image) => image.productId === product.id).length,
    digitalTwinCount: (data.productDigitalTwins || []).filter((asset) => asset.productId === product.id).length,
    listingCount: data.listings.filter((listing) => variantIdSet.has(listing.variantId)).length,
    channelDraftCount: draftIds.size,
    inventoryBalanceCount,
    stockMovementCount,
    purchaseReferenceCount,
    orderReferenceCount,
    lotReferenceCount,
    activeListingCount,
    generatedRecordCount: (data.productImages || []).filter((image) => image.productId === product.id).length
      + (data.productDigitalTwins || []).filter((asset) => asset.productId === product.id).length
      + data.listings.filter((listing) => variantIdSet.has(listing.variantId)).length
      + draftIds.size
      + data.balances.filter((balance) => variantIdSet.has(balance.variantId)).length
      + (data.physicalSkuMappings || []).filter((mapping) => variantIdSet.has(mapping.variantId)).length
      + (data.inventoryRiskLocks || []).filter((lock) => variantIdSet.has(lock.variantId)).length,
    shouldArchive,
    reason: shouldArchive ? "has_operating_history" : "no_operating_history",
  };
}

export function hardDeleteProductGraph(data: OperatingData, product: Product): ProductDeleteDependencySummary {
  const summary = productDeleteDependencySummary(data, product);
  const variantIdSet = new Set(summary.variantIds);
  const draftIds = new Set((data.channelListingDrafts || []).filter((entry) => variantIdSet.has(entry.variantId)).map((entry) => entry.id));
  const listingIds = new Set(data.listings.filter((entry) => variantIdSet.has(entry.variantId)).map((entry) => entry.id));

  data.listingReviewItems = (data.listingReviewItems || []).filter((entry) => !entry.channelDraftId || !draftIds.has(entry.channelDraftId));
  data.listingSyncJobs = (data.listingSyncJobs || []).filter((entry) => !draftIds.has(entry.channelDraftId));
  data.channelListingDrafts = (data.channelListingDrafts || []).filter((entry) => !variantIdSet.has(entry.variantId));
  data.channelSyncStates = (data.channelSyncStates || []).filter((entry) => !variantIdSet.has(entry.variantId) && !listingIds.has(entry.listingId));
  data.physicalSkuMappings = (data.physicalSkuMappings || []).filter((entry) => !variantIdSet.has(entry.variantId));
  data.inventoryRiskLocks = (data.inventoryRiskLocks || []).filter((entry) => !variantIdSet.has(entry.variantId));
  data.listings = data.listings.filter((entry) => !variantIdSet.has(entry.variantId));
  data.balances = data.balances.filter((entry) => !variantIdSet.has(entry.variantId));
  data.productDigitalTwins = (data.productDigitalTwins || []).filter((entry) => entry.productId !== product.id);
  data.productImages = (data.productImages || []).filter((entry) => entry.productId !== product.id);
  data.variants = data.variants.filter((entry) => !variantIdSet.has(entry.id));
  data.products = data.products.filter((entry) => entry.id !== product.id);
  data.notices = data.notices.filter((notice) => !notice.entityId || (notice.entityId !== product.id && !variantIdSet.has(notice.entityId) && !listingIds.has(notice.entityId)));

  return summary;
}

export function archiveProductGraph(data: OperatingData, product: Product, variants: Variant[], archivedAt: string) {
  const variantIds = new Set(variants.map((entry) => entry.id));
  product.status = "paused";
  product.updatedAt = archivedAt;
  for (const variant of variants) variant.active = false;
  for (const listing of data.listings.filter((entry) => variantIds.has(entry.variantId))) {
    listing.status = "paused";
    listing.quantity = 0;
  }
  for (const draft of data.channelListingDrafts?.filter((entry) => variantIds.has(entry.variantId)) || []) {
    draft.status = "paused";
    draft.quantity = 0;
    draft.updatedAt = archivedAt;
  }
  for (const mapping of data.physicalSkuMappings?.filter((entry) => variantIds.has(entry.variantId)) || []) {
    mapping.status = "archived";
    mapping.updatedAt = archivedAt;
  }
  for (const lock of data.inventoryRiskLocks?.filter((entry) => variantIds.has(entry.variantId) && entry.status === "active") || []) {
    lock.status = "released";
    lock.releasedAt = archivedAt;
    lock.notes = lock.notes ? `${lock.notes} Product removed from catalog.` : "Product removed from catalog.";
  }
}
