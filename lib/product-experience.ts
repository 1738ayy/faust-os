import type { Activity, Marketplace, OperatingData, Product, Variant } from "@/domain/business";
import { availableUnits, money, orderProfit } from "@/lib/business-calculations";
import { buildProductIntelligence, type ProductIntelligence } from "@/lib/product-intelligence";
import { getProductReadiness } from "@/lib/product-readiness";

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
  supplierName: string;
  supplierDetail: string;
  readiness: ReturnType<typeof getProductReadiness>;
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
  timeline: { id: string; title: string; detail: string; at: string }[];
};

const marketplaceOrder: Exclude<Marketplace, "Manual">[] = ["Depop", "eBay", "Etsy", "Mercari", "Poshmark"];

export function buildProductExperiences(data: OperatingData): ProductExperience[] {
  return data.variants
    .filter((variant) => variant.active)
    .map((variant) => {
      const product = data.products.find((entry) => entry.id === variant.productId);
      if (!product) return null;
      return buildProductExperience(data, product, variant);
    })
    .filter(Boolean) as ProductExperience[];
}

export function buildProductExperience(data: OperatingData, product: Product, variant: Variant): ProductExperience {
  const balances = data.balances.filter((balance) => balance.variantId === variant.id);
  const drafts = data.channelListingDrafts?.filter((draft) => draft.variantId === variant.id) || [];
  const listings = data.listings.filter((listing) => listing.variantId === variant.id);
  const supplier = data.suppliers.find((entry) => entry.id === product.supplierId);
  const purchaseOrders = data.purchaseOrders.filter((po) => po.items.some((item) => item.variantId === variant.id));
  const lots = data.inventoryLots?.filter((lot) => lot.variantId === variant.id) || [];
  const orderItems = data.orders.flatMap((order) => order.items.filter((item) => item.variantId === variant.id).map((item) => ({ order, item })));
  const movements = data.stockMovements.filter((movement) => movement.variantId === variant.id);
  const readiness = getProductReadiness(data, variant, product);
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
  const profit = orderItems.reduce((sum, { order, item }) => {
    const contribution = orderProfit(order, data.variants).lineContributions.find((line) => line.itemId === item.id);
    return sum + (contribution?.contributionProfit || 0);
  }, 0);
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
  const recommended = productAiRecommendation(readiness.score, inventory.available, variant.reorderPoint, marketplaces, margin);

  return {
    product,
    variant,
    href: `/catalog/${variant.id}`,
    image: product.image || drafts.find((draft) => draft.imageUrls.length)?.imageUrls[0],
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
    timeline,
  };
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
