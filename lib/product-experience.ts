import type { Activity, Marketplace, OperatingData, Product, Variant } from "../domain/business";
import { availableUnits, money } from "./business-calculations";
import { buildProductIntelligence, type ProductIntelligence } from "./product-intelligence";
import { productCoverImage, productCoverRecord, productImageRevision } from "./product-images";
import type { ProductReadiness } from "./product-readiness";
import { productKnowledgeSummary } from "./product-knowledge";
import { visualIntelligenceSummary } from "./product-visual-intelligence";
import { isActiveProduct, isActiveVariant } from "./product-state";

export type MarketplacePresence = {
  marketplace: Exclude<Marketplace, "Manual">;
  status: "draft" | "pending" | "live" | "rejected" | "out_of_stock";
  detail: string;
  href?: string;
};

export type ProductExperience = {
  product: Product;
  variant: Variant;
  href: string;
  image?: string;
  coverImage?: { id: string; url: string; revision: string | null };
  supplierName: string;
  supplierDetail: string;
  readiness: ProductReadiness;
  inventory: {
    onHand: number;
    reserved: number;
    available: number;
    incoming: number;
    damaged: number;
    returned: number;
    lost: number;
    quarantined: number;
    value: number;
  };
  finance: {
    cost: number;
    sellingPrice: number;
    revenue: number;
    profit: number;
    margin: number;
    roi: number;
    averageSellingPrice: number;
    cashInvested: number;
    cashReturned: number;
    projectedRevenue: number;
  };
  analytics: {
    unitsSold: number;
    returns: number;
    sellThrough: number;
    bestMarketplace: string;
    velocityLabel: string;
  };
  purchasing: {
    leadTime: string;
    moq: string;
    reorderPoint: number;
    recommendedReorderQuantity: number;
    openPurchaseOrders: number;
    purchasingHistory: number;
  };
  marketplaces: MarketplacePresence[];
  ai: {
    recommendation: string;
    confidence: number;
    evidence: string;
    nextAction: string;
  };
  intelligence: ProductIntelligence;
  productKnowledge: ReturnType<typeof productKnowledgeSummary>;
  visualIntelligence: ReturnType<typeof visualIntelligenceSummary>;
  timeline: { id: string; title: string; detail: string; at: string }[];
};

const marketplaceOrder: Exclude<Marketplace, "Manual">[] = ["Depop", "eBay", "Etsy", "Mercari", "Poshmark"];

type ProductExperienceIndexes = ReturnType<typeof buildProductExperienceIndexes>;

function groupBy<T>(items: T[], key: (item: T) => string | undefined) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    if (!value) continue;
    const existing = map.get(value);
    if (existing) existing.push(item);
    else map.set(value, [item]);
  }
  return map;
}

function buildProductExperienceIndexes(data: OperatingData) {
  const orderItemsByVariantId = new Map<string, { order: OperatingData["orders"][number]; item: OperatingData["orders"][number]["items"][number] }[]>();
  for (const order of data.orders) {
    for (const item of order.items) {
      const entries = orderItemsByVariantId.get(item.variantId);
      if (entries) entries.push({ order, item });
      else orderItemsByVariantId.set(item.variantId, [{ order, item }]);
    }
  }
  const purchaseOrdersByVariantId = new Map<string, OperatingData["purchaseOrders"]>();
  for (const po of data.purchaseOrders) {
    for (const item of po.items) {
      const entries = purchaseOrdersByVariantId.get(item.variantId);
      if (entries && !entries.some((entry) => entry.id === po.id)) entries.push(po);
      else if (!entries) purchaseOrdersByVariantId.set(item.variantId, [po]);
    }
  }
  return {
    productsById: new Map(data.products.map((product) => [product.id, product])),
    suppliersById: new Map(data.suppliers.map((supplier) => [supplier.id, supplier])),
    balancesByVariantId: groupBy(data.balances, (balance) => balance.variantId),
    draftsByVariantId: groupBy(data.channelListingDrafts || [], (draft) => draft.variantId),
    listingsByVariantId: groupBy(data.listings, (listing) => listing.variantId),
    purchaseOrdersByVariantId,
    lotsByVariantId: groupBy(data.inventoryLots || [], (lot) => lot.variantId),
    orderItemsByVariantId,
    movementsByVariantId: groupBy(data.stockMovements, (movement) => movement.variantId),
    productImagesByProductId: groupBy(data.productImages || [], (image) => image.productId),
    productImageQualityByProductId: groupBy(data.productImageQuality || [], (quality) => quality.productId),
    productKnowledgeFieldsByProductId: groupBy(data.productKnowledgeFields || [], (field) => field.productId),
    productImageObservationsByProductId: groupBy(data.productImageObservations || [], (observation) => observation.productId),
    productImageReviewDecisionsByProductId: groupBy(data.productImageReviewDecisions || [], (decision) => decision.productId),
  };
}

export function buildProductExperiences(data: OperatingData): ProductExperience[] {
  const indexes = buildProductExperienceIndexes(data);
  return data.variants
    .filter((variant) => variant.active && isActiveProduct(indexes.productsById.get(variant.productId)))
    .map((variant) => {
      const product = indexes.productsById.get(variant.productId);
      if (!product) return null;
      return buildProductExperienceIndexed(data, product, variant, indexes);
    })
    .filter(Boolean) as ProductExperience[];
}

export function buildProductExperienceByVariantId(data: OperatingData, variantId: string): ProductExperience | undefined {
  const variant = data.variants.find((entry) => entry.id === variantId);
  if (!variant || !isActiveVariant(data, variant)) return undefined;
  const product = data.products.find((entry) => entry.id === variant.productId);
  if (!product || !isActiveProduct(product)) return undefined;
  return buildProductExperience(data, product, variant);
}

export function buildProductExperience(data: OperatingData, product: Product, variant: Variant): ProductExperience {
  return buildProductExperienceIndexed(data, product, variant, buildProductExperienceIndexes(data));
}

function buildProductExperienceIndexed(data: OperatingData, product: Product, variant: Variant, indexes: ProductExperienceIndexes): ProductExperience {
  if (!isActiveProduct(product) || !variant.active || variant.productId !== product.id) throw new Error("Product is not active in the catalog.");
  const balances = indexes.balancesByVariantId.get(variant.id) || [];
  const drafts = indexes.draftsByVariantId.get(variant.id) || [];
  const listings = indexes.listingsByVariantId.get(variant.id) || [];
  const supplier = product.supplierId ? indexes.suppliersById.get(product.supplierId) : undefined;
  const purchaseOrders = indexes.purchaseOrdersByVariantId.get(variant.id) || [];
  const lots = indexes.lotsByVariantId.get(variant.id) || [];
  const orderItems = indexes.orderItemsByVariantId.get(variant.id) || [];
  const movements = indexes.movementsByVariantId.get(variant.id) || [];
  const storedProductImages = indexes.productImagesByProductId.get(product.id) || [];
  const visualIntelligence = storedProductImages.length ? visualIntelligenceSummary(data, product.id) : emptyVisualIntelligenceSummary();
  const readiness = getProductReadinessIndexed(data, variant, product, indexes, balances, drafts);
  const inventory = {
    onHand: balances.reduce((sum, balance) => sum + balance.onHand, 0),
    reserved: balances.reduce((sum, balance) => sum + balance.reserved, 0),
    available: balances.reduce((sum, balance) => sum + availableUnits(balance), 0),
    incoming: balances.reduce((sum, balance) => sum + balance.incoming, 0),
    damaged: balances.reduce((sum, balance) => sum + balance.damaged, 0),
    returned: balances.reduce((sum, balance) => sum + balance.returned, 0),
    lost: balances.reduce((sum, balance) => sum + balance.lost, 0),
    quarantined: balances.reduce((sum, balance) => sum + balance.quarantined, 0),
    value: balances.reduce((sum, balance) => sum + balance.onHand * variant.landedUnitCost, 0),
  };
  const revenue = orderItems.reduce((sum, { item }) => sum + item.unitSellingPrice * item.quantity, 0);
  const profit = orderItems.reduce((sum, { item }) => sum + lineContributionProfit(item), 0);
  const unitsSold = orderItems.reduce((sum, { item }) => sum + item.quantity, 0);
  const returned = orderItems.reduce((sum, { item }) => sum + (item.returnedQuantity || 0), 0);
  const averageSellingPrice = unitsSold ? revenue / unitsSold : variant.defaultSalePrice;
  const cashInvested = lots.length ? lots.reduce((sum, lot) => sum + lot.totalLandedCostUsd, 0) : inventory.value;
  const cashReturned = revenue;
  const marketplaceCounts = orderItems.reduce<Record<string, number>>((counts, { order }) => ({ ...counts, [order.marketplace]: (counts[order.marketplace] || 0) + 1 }), {});
  const bestMarketplace = Object.entries(marketplaceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || drafts[0]?.marketplace || listings[0]?.marketplace || "Not proven yet";
  const marketplaces = marketplaceOrder.map((marketplace) => {
    const draft = drafts.find((entry) => entry.marketplace === marketplace);
    const listing = listings.find((entry) => entry.marketplace === marketplace);
    const quantity = draft?.quantity ?? listing?.quantity ?? inventory.available;
    const status: MarketplacePresence["status"] = listing?.status === "active" || draft?.status === "published" ? "live" : draft?.status === "failed" || listing?.status === "failed" ? "rejected" : quantity <= 0 ? "out_of_stock" : draft ? "draft" : "pending";
    return { marketplace, status, detail: draft?.validationErrors[0] || listing?.marketplaceUrl || draft?.publishMode || "Draft not generated", href: draft?.externalUrl || listing?.marketplaceUrl };
  });
  const timeline = buildTimeline(data.activity, product, variant, movements);
  const coverRecord = productCoverRecord(data, product);
  const coverImage = coverRecord?.url || productCoverImage(data, product) || drafts.find((draft) => draft.imageUrls.length)?.imageUrls[0];
  const margin = revenue ? profit / revenue * 100 : variant.defaultSalePrice ? (variant.defaultSalePrice - variant.landedUnitCost) / variant.defaultSalePrice * 100 : 0;
  const roi = variant.landedUnitCost ? (variant.defaultSalePrice - variant.landedUnitCost) / variant.landedUnitCost * 100 : 0;
  const finance = {
    cost: variant.landedUnitCost,
    sellingPrice: variant.defaultSalePrice,
    revenue,
    profit,
    margin,
    roi,
    averageSellingPrice,
    cashInvested,
    cashReturned,
    projectedRevenue: inventory.available * variant.defaultSalePrice,
  };
  const analytics = {
    unitsSold,
    returns: returned,
    sellThrough: inventory.onHand + unitsSold ? unitsSold / (inventory.onHand + unitsSold) * 100 : 0,
    bestMarketplace,
    velocityLabel: unitsSold ? `${unitsSold} unit(s) sold from stored orders` : "No sales velocity yet",
  };
  const intelligence = buildProductIntelligence({ data, product, variant, supplier, readiness, marketplaces, inventory, finance, analytics });
  const productKnowledge = productKnowledgeSummary(data, product.id);
  const recommended = productAiRecommendation(readiness.score, inventory.available, variant.reorderPoint, marketplaces, margin);

  return {
    product,
    variant,
    href: `/catalog/${variant.id}`,
    image: coverImage,
    coverImage: coverRecord ? { id: coverRecord.id, url: coverRecord.url, revision: productImageRevision(coverRecord) } : undefined,
    supplierName: supplier?.name || "Supplier not linked",
    supplierDetail: supplier ? `${supplier.sourcePlatform}${supplier.leadDays ? ` · ${supplier.leadDays} day lead time` : ""}` : "Link supplier before purchasing.",
    readiness,
    inventory,
    finance,
    analytics,
    purchasing: {
      leadTime: supplier?.leadDays ? `${supplier.leadDays} days` : "Unknown",
      moq: "Use supplier MOQ when captured",
      reorderPoint: variant.reorderPoint,
      recommendedReorderQuantity: variant.reorderQuantity,
      openPurchaseOrders: purchaseOrders.filter((po) => po.status !== "received").length,
      purchasingHistory: purchaseOrders.length,
    },
    marketplaces,
    ai: {
      recommendation: recommended.recommendation,
      confidence: Math.max(recommended.confidence, intelligence.recommendation.confidence),
      evidence: `${readiness.score}/100 readiness · ${inventory.available} available · ${money(profit)} profit · ${marketplaces.filter((market) => market.status === "live").length} live marketplace(s)`,
      nextAction: readiness.nextAction,
    },
    intelligence,
    productKnowledge,
    visualIntelligence,
    timeline,
  };
}

function emptyVisualIntelligenceSummary(): ReturnType<typeof visualIntelligenceSummary> {
  return {
    observations: [],
    qualities: [],
    recommendation: undefined,
    categoryCandidates: [],
    coverImageId: undefined,
    conflict: undefined,
    observability: {
      imageObservationsCreated: 0,
      categoryConflictsDetected: 0,
      coverRecommendationsAccepted: 0,
      coverRecommendationsOverridden: 0,
      imageDerivedFieldsApproved: 0,
      imageDerivedFieldsCorrected: 0,
      falsePositiveImageSuggestions: 0,
    },
  };
}

function lineContributionProfit(item: OperatingData["orders"][number]["items"][number]) {
  const netSales = item.unitSellingPrice * item.quantity - item.discountAllocation;
  const cogs = (item.unitCost || 0) * item.quantity;
  const marketplaceFees = item.marketplaceFeeAllocation || item.feeAllocation || 0;
  const paymentFees = item.paymentFeeAllocation || 0;
  return netSales - cogs - marketplaceFees - paymentFees;
}

function getProductReadinessIndexed(
  data: OperatingData,
  variant: Variant,
  product: Product,
  indexes: ProductExperienceIndexes,
  balances: OperatingData["balances"],
  listings: NonNullable<OperatingData["channelListingDrafts"]>,
) {
  const productImages = indexes.productImagesByProductId.get(product.id) || [];
  const imageQuality = indexes.productImageQualityByProductId.get(product.id) || [];
  const knowledgeFields = indexes.productKnowledgeFieldsByProductId.get(product.id) || [];
  const imageObservations = indexes.productImageObservationsByProductId.get(product.id) || [];
  const imageDecisions = indexes.productImageReviewDecisionsByProductId.get(product.id) || [];

  const available = balances.reduce((sum, balance) => sum + availableUnits(balance), 0);
  const publishedCount = listings.filter((draft) => draft.status === "published").length;
  const marketplaces = new Set(listings.map((draft) => draft.marketplace));
  const supplier = product.supplierId ? indexes.suppliersById.get(product.supplierId) : undefined;
  const projectedMargin = variant.defaultSalePrice ? (variant.defaultSalePrice - variant.landedUnitCost) / variant.defaultSalePrice * 100 : 0;
  const coverImageId = product.coverImageId || productImages.find((image) => image.isCover)?.id;
  const coverQuality = imageQuality.find((quality) => quality.imageId === coverImageId);
  const hasPhotos = Boolean(product.image) || productImages.length > 0 || listings.some((draft) => draft.imageUrls.length);
  const hasUsableCover = hasPhotos && (!imageQuality.length || Boolean(coverQuality && !["size_chart", "detail", "excluded", "duplicate"].includes(coverQuality.role) && coverQuality.marketplaceSuitability >= 60));
  const categoryConflict = Boolean(
    knowledgeFields.some((field) => field.fieldKey === "universal_category" && field.source === "evidence")
      && imageObservations.some((observation) => observation.observationType === "category_candidate")
      && !imageDecisions.some((decision) => ["approve_category_candidate", "reject_category_candidate"].includes(decision.action))
  );
  const hasCategory = (Boolean(product.category) || listings.some((draft) => draft.category)) && !categoryConflict;
  const hasDescription = listings.some((draft) => draft.description.length > 40);
  const hasMarketplaceCompliance = listings.length > 0 && listings.every((draft) => draft.validationErrors.length === 0);
  const hasShippingProfile = Boolean(variant.weightOz) || listings.some((draft) => draft.attributes.shipping || draft.attributes.shippingProfile);
  const hasSeo = listings.some((draft) => draft.title.length >= 30 && draft.description.length >= 80);
  const hasCost = Boolean(variant.landedUnitCost && variant.landedUnitCost > 0);
  const hasPrice = Boolean(variant.defaultSalePrice && variant.defaultSalePrice > 0);
  const dimensions = [
    { key: "photos" as const, label: "Photos", ready: hasPhotos, detail: hasPhotos ? "Primary image or draft images are present." : "Add product and listing photos." },
    { key: "cover_image" as const, label: "Cover image", ready: hasUsableCover, detail: hasUsableCover ? "A publishable cover image is selected." : "Review the recommended cover image or choose a better photo." },
    { key: "pricing" as const, label: "Pricing", ready: hasPrice, detail: hasPrice ? `Default price is $${variant.defaultSalePrice.toFixed(2)}.` : "Set the target selling price." },
    { key: "supplier" as const, label: "Supplier", ready: Boolean(supplier), detail: supplier ? supplier.name : "Link the supplier." },
    { key: "inventory" as const, label: "Inventory", ready: available > 0, detail: `${available} sellable unit(s) available.` },
    { key: "marketplace_category" as const, label: "Marketplace category", ready: hasCategory, detail: categoryConflict ? "Supplier and image evidence disagree; review the category candidate." : hasCategory ? "Product or draft category is present." : "Choose a marketplace-ready category." },
    { key: "seo" as const, label: "SEO", ready: hasSeo, detail: hasSeo ? "Draft title/description have enough marketplace detail." : "Improve title and description depth." },
    { key: "description" as const, label: "Description", ready: hasDescription || Boolean(product.title), detail: hasDescription ? "Marketplace description is ready." : "Complete product description." },
    { key: "shipping_profile" as const, label: "Shipping profile", ready: hasShippingProfile, detail: hasShippingProfile ? "Weight or shipping profile exists." : "Add weight or shipping profile." },
    { key: "cost_validation" as const, label: "Cost validation", ready: hasCost, detail: hasCost ? `Landed cost is $${variant.landedUnitCost.toFixed(2)}.` : "Validate landed cost." },
    { key: "margin_validation" as const, label: "Margin validation", ready: hasPrice && hasCost && projectedMargin >= 35, detail: hasPrice && hasCost ? `${projectedMargin.toFixed(1)}% projected margin.` : "Needs price and cost first." },
    { key: "marketplace_compliance" as const, label: "Marketplace compliance", ready: hasMarketplaceCompliance, detail: hasMarketplaceCompliance ? "Drafts have no validation errors." : "Fix draft validation issues." },
  ];
  const missing = dimensions.filter((dimension) => !dimension.ready).map((dimension) => dimension.label.toLowerCase());
  const score = Math.round(dimensions.filter((dimension) => dimension.ready).length / dimensions.length * 100);
  if (publishedCount >= 5) return { status: "published_everywhere" as const, score: 100, missing: [], nextAction: "Monitor marketplace performance", dimensions };
  if (publishedCount > 0) return { status: "live" as const, score: Math.max(80, score), missing, nextAction: "Review marketplace health", dimensions };
  if (available <= 0) return { status: "waiting_for_inventory" as const, score: Math.max(18, score), missing, nextAction: "Receive inventory", dimensions };
  if (!hasPhotos) return { status: "needs_photos" as const, score: Math.max(28, score), missing, nextAction: "Add listing photos", dimensions };
  if (!hasPrice || !hasCost || projectedMargin < 35) return { status: "needs_pricing_review" as const, score: Math.max(35, score), missing, nextAction: "Review pricing", dimensions };
  if (missing.length >= 5) return { status: "needs_work" as const, score, missing, nextAction: "Complete product basics", dimensions };
  if (missing.length >= 3) return { status: "incomplete" as const, score, missing, nextAction: "Complete readiness checklist", dimensions };
  if (missing.length) return { status: "almost_ready" as const, score, missing, nextAction: "Finish final listing details", dimensions };
  if (marketplaces.size < 5) return { status: "ready" as const, score: Math.max(92, score), missing: [], nextAction: "Generate marketplace drafts", dimensions };
  return { status: "ready" as const, score: Math.max(95, score), missing: [], nextAction: "Publish selected marketplaces", dimensions };
}

function productAiRecommendation(readinessScore: number, available: number, reorderPoint: number, marketplaces: MarketplacePresence[], margin: number) {
  if (available <= 0) return { recommendation: "Receive or purchase inventory before publishing this product.", confidence: 0.84 };
  if (readinessScore < 70) return { recommendation: "Finish the readiness checklist before creating more listing work.", confidence: 0.78 };
  if (marketplaces.some((market) => market.status === "rejected")) return { recommendation: "Fix rejected marketplace drafts before expanding distribution.", confidence: 0.81 };
  if (available <= reorderPoint) return { recommendation: "Prepare a reorder plan before sellable stock gets too thin.", confidence: 0.82 };
  if (margin >= 50) return { recommendation: "This product is ready to publish or scale across selected marketplaces.", confidence: 0.86 };
  return { recommendation: "Review pricing and fees before scaling this product.", confidence: 0.74 };
}

function buildTimeline(activity: Activity[], product: Product, variant: Variant, movements: { id: string; type: string; quantity: number; createdAt: string; note?: string }[]) {
  const events = [
    { id: `${product.id}-created`, title: "Product created", detail: product.sourceUrl ? "Imported from source workflow." : "Created in Faust.", at: product.createdAt },
    ...activity.filter((entry) => entry.entityId === product.id || entry.entityId === variant.id || entry.detail.includes(variant.sku)).slice(0, 8).map((entry) => ({ id: entry.id, title: entry.action, detail: entry.detail, at: entry.createdAt })),
    ...movements.slice(0, 8).map((movement) => ({ id: movement.id, title: movement.type.replaceAll("_", " "), detail: `${movement.quantity > 0 ? "+" : ""}${movement.quantity}${movement.note ? ` · ${movement.note}` : ""}`, at: movement.createdAt })),
  ];
  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 12);
}
