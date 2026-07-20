import type { Marketplace, OperatingData, Product, Supplier, Variant } from "@/domain/business";
import type { MarketplacePresence } from "@/lib/product-experience";
import { activeVariants } from "./product-state";
import type { ProductReadiness } from "@/lib/product-readiness";

export type ProductDnaTag =
  | "Fast seller"
  | "High margin"
  | "Reliable supplier"
  | "Low return rate"
  | "Ready to publish"
  | "Growing demand"
  | "Cash efficient"
  | "Needs attention"
  | "Inventory risk"
  | "Marketplace risk";

export type ProductHealthSignal = {
  label: string;
  status: "strong" | "healthy" | "watch" | "risk" | "unknown";
  value: string;
  meaning: string;
};

export type ProductRelationship = {
  type: "shared_supplier" | "shared_category" | "similar_price" | "same_marketplace";
  label: string;
  href: string;
  detail: string;
};

export type ProductIntelligence = {
  faustScore: {
    score: number;
    label: string;
    explanation: string;
    components: { label: string; score: number; detail: string }[];
  };
  health: ProductHealthSignal[];
  dna: { tag: ProductDnaTag; reason: string }[];
  relationships: ProductRelationship[];
  recommendation: {
    situation: string;
    reasoning: string;
    expectedOutcome: string;
    confidence: number;
    confidenceBasis: string[];
  };
};

export function buildProductIntelligence(params: {
  data: OperatingData;
  product: Product;
  variant: Variant;
  supplier?: Supplier;
  readiness: ProductReadiness;
  marketplaces: MarketplacePresence[];
  inventory: { available: number; onHand: number; incoming: number; value: number };
  finance: { revenue: number; profit: number; margin: number; roi: number; projectedRevenue: number };
  analytics: { unitsSold: number; returns: number; sellThrough: number; bestMarketplace: string };
}): ProductIntelligence {
  const { data, product, variant, supplier, readiness, marketplaces, inventory, finance, analytics } = params;
  const liveMarketplaces = marketplaces.filter((marketplace) => marketplace.status === "live").length;
  const rejectedMarketplaces = marketplaces.filter((marketplace) => marketplace.status === "rejected").length;
  const returnRate = analytics.unitsSold ? analytics.returns / analytics.unitsSold * 100 : 0;
  const inventoryDays = estimateInventoryDays(inventory.available, analytics.unitsSold);
  const supplierScore = supplier?.rating ? Math.round(Math.min(100, supplier.rating / 5 * 100)) : supplier?.leadDays ? 72 : 45;
  const inventoryScore = scoreInventory(inventory.available, variant.reorderPoint, analytics.unitsSold);
  const profitabilityScore = Math.round(clamp(finance.margin * 1.4 + Math.min(finance.roi, 300) * 0.1, 0, 100));
  const marketplaceScore = Math.round(clamp(liveMarketplaces * 18 + (marketplaces.length - rejectedMarketplaces) * 4, 0, 100));
  const confidenceScore = confidenceFromEvidence({ unitsSold: analytics.unitsSold, supplierKnown: Boolean(supplier), liveMarketplaces, readinessScore: readiness.score });
  const faustScore = Math.round(
    readiness.score * 0.24 +
      inventoryScore * 0.18 +
      profitabilityScore * 0.22 +
      marketplaceScore * 0.16 +
      supplierScore * 0.1 +
      confidenceScore * 0.1,
  );
  const health = buildHealthSignals({
    inventory,
    finance,
    analytics,
    inventoryDays,
    liveMarketplaces,
    rejectedMarketplaces,
    supplier,
    variant,
    returnRate,
  });
  const dna = buildDna({
    readiness,
    inventory,
    finance,
    analytics,
    supplier,
    liveMarketplaces,
    rejectedMarketplaces,
    returnRate,
  });
  const relationships = buildRelationships(data, product, variant, marketplaces);
  const recommendation = buildRecommendation({
    readiness,
    inventory,
    finance,
    analytics,
    supplier,
    liveMarketplaces,
    rejectedMarketplaces,
    inventoryDays,
    faustScore,
    confidenceScore,
  });

  return {
    faustScore: {
      score: faustScore,
      label: faustScoreLabel(faustScore),
      explanation: faustScoreExplanation(faustScore),
      components: [
        { label: "Readiness", score: readiness.score, detail: readiness.nextAction },
        { label: "Inventory health", score: inventoryScore, detail: inventoryDays ? `About ${inventoryDays} day(s) of stock at current stored sales pace.` : "Needs more sales history for inventory-day confidence." },
        { label: "Profitability", score: profitabilityScore, detail: `${finance.margin.toFixed(1)}% margin and ${finance.roi.toFixed(1)}% projected ROI.` },
        { label: "Marketplace health", score: marketplaceScore, detail: `${liveMarketplaces} live channel(s), ${rejectedMarketplaces} needing review.` },
        { label: "Supplier confidence", score: supplierScore, detail: supplier ? `${supplier.name}${supplier.leadDays ? `, ${supplier.leadDays} day lead time.` : "."}` : "Supplier is not linked yet." },
      ],
    },
    health,
    dna,
    relationships,
    recommendation,
  };
}

function buildHealthSignals(params: {
  inventory: { available: number; incoming: number; value: number };
  finance: { revenue: number; profit: number; margin: number; roi: number; projectedRevenue: number };
  analytics: { unitsSold: number; returns: number; sellThrough: number; bestMarketplace: string };
  inventoryDays?: number;
  liveMarketplaces: number;
  rejectedMarketplaces: number;
  supplier?: Supplier;
  variant: Variant;
  returnRate: number;
}): ProductHealthSignal[] {
  const { inventory, finance, analytics, inventoryDays, liveMarketplaces, rejectedMarketplaces, supplier, variant, returnRate } = params;
  return [
    {
      label: "Inventory",
      status: inventory.available <= 0 ? "risk" : inventory.available <= variant.reorderPoint ? "watch" : "healthy",
      value: `${inventory.available} sellable`,
      meaning: inventoryDays ? `Approximately ${inventoryDays} day(s) remaining at the stored sales pace.` : inventory.available > 0 ? "Stock is available, but Faust needs more order history to estimate days remaining." : "This cannot be sold until inventory is received or adjusted.",
    },
    {
      label: "Margin",
      status: finance.margin >= 50 ? "strong" : finance.margin >= 35 ? "healthy" : finance.margin > 0 ? "watch" : "unknown",
      value: `${finance.margin.toFixed(1)}%`,
      meaning: finance.margin >= 50 ? "Strong spread between cost and sale price." : finance.margin >= 35 ? "Healthy margin, but still worth monitoring fees and shipping." : finance.margin > 0 ? "Margin is thin; review pricing before scaling." : "Margin will become clearer after sales or pricing updates.",
    },
    {
      label: "Marketplace",
      status: rejectedMarketplaces ? "risk" : liveMarketplaces ? "healthy" : "watch",
      value: liveMarketplaces ? `${liveMarketplaces} live` : "Not live yet",
      meaning: rejectedMarketplaces ? `${rejectedMarketplaces} channel(s) need listing review before scaling.` : liveMarketplaces ? `${analytics.bestMarketplace} is the strongest observed channel.` : "Generate or publish drafts to start marketplace learning.",
    },
    {
      label: "Supplier",
      status: supplier?.rating && supplier.rating >= 4.5 ? "strong" : supplier ? "healthy" : "unknown",
      value: supplier?.leadDays ? `${supplier.leadDays} day lead` : "Not proven",
      meaning: supplier ? "Supplier context is linked for purchasing and reorder decisions." : "Link a supplier to improve reorder confidence.",
    },
    {
      label: "Returns",
      status: analytics.unitsSold === 0 ? "unknown" : returnRate <= 5 ? "healthy" : returnRate <= 12 ? "watch" : "risk",
      value: analytics.unitsSold ? `${returnRate.toFixed(1)}%` : "No history",
      meaning: analytics.unitsSold ? `${analytics.returns} returned unit(s) from ${analytics.unitsSold} sold.` : "Return behavior needs order history before Faust can judge risk.",
    },
  ];
}

function buildDna(params: {
  readiness: ProductReadiness;
  inventory: { available: number };
  finance: { margin: number; roi: number };
  analytics: { unitsSold: number; returns: number; sellThrough: number };
  supplier?: Supplier;
  liveMarketplaces: number;
  rejectedMarketplaces: number;
  returnRate: number;
}) {
  const tags: { tag: ProductDnaTag; reason: string }[] = [];
  if (params.analytics.unitsSold >= 5 || params.analytics.sellThrough >= 50) tags.push({ tag: "Fast seller", reason: "Stored orders show meaningful sell-through." });
  if (params.finance.margin >= 50) tags.push({ tag: "High margin", reason: "Projected or realized margin is above 50%." });
  if (params.supplier?.rating && params.supplier.rating >= 4.5) tags.push({ tag: "Reliable supplier", reason: "Supplier rating is strong in Faust records." });
  if (params.analytics.unitsSold && params.returnRate <= 5) tags.push({ tag: "Low return rate", reason: "Returns are low compared with sold units." });
  if (params.readiness.score >= 85 && params.inventory.available > 0) tags.push({ tag: "Ready to publish", reason: "Readiness is high and stock is sellable." });
  if (params.analytics.sellThrough >= 35 && params.inventory.available > 0) tags.push({ tag: "Growing demand", reason: "Sell-through suggests the product is moving." });
  if (params.finance.roi >= 150) tags.push({ tag: "Cash efficient", reason: "Projected ROI is high relative to landed cost." });
  if (params.readiness.score < 65 || params.rejectedMarketplaces > 0) tags.push({ tag: "Needs attention", reason: "Readiness or marketplace validation needs work." });
  if (params.inventory.available <= 0) tags.push({ tag: "Inventory risk", reason: "No sellable stock is currently available." });
  if (params.rejectedMarketplaces > 0) tags.push({ tag: "Marketplace risk", reason: "One or more channels need review." });
  return tags.slice(0, 6);
}

function buildRelationships(data: OperatingData, product: Product, variant: Variant, marketplaces: MarketplacePresence[]): ProductRelationship[] {
  const variantIdsByMarketplace = new Map<Marketplace, Set<string>>();
  for (const listing of data.listings) {
    if (listing.variantId !== variant.id) {
      const set = variantIdsByMarketplace.get(listing.marketplace) || new Set<string>();
      set.add(listing.variantId);
      variantIdsByMarketplace.set(listing.marketplace, set);
    }
  }
  return activeVariants(data)
    .filter((entry) => entry.id !== variant.id)
    .map((entry) => {
      const relatedProduct = data.products.find((candidate) => candidate.id === entry.productId);
      if (!relatedProduct) return undefined;
      if (relatedProduct.supplierId && relatedProduct.supplierId === product.supplierId) {
        return { type: "shared_supplier" as const, label: `${relatedProduct.title} — ${entry.sku}`, href: `/catalog/${entry.id}`, detail: "Uses the same supplier." };
      }
      if (relatedProduct.category === product.category) {
        return { type: "shared_category" as const, label: `${relatedProduct.title} — ${entry.sku}`, href: `/catalog/${entry.id}`, detail: `Also in ${product.category}.` };
      }
      if (Math.abs(entry.defaultSalePrice - variant.defaultSalePrice) <= 5) {
        return { type: "similar_price" as const, label: `${relatedProduct.title} — ${entry.sku}`, href: `/catalog/${entry.id}`, detail: "Similar target selling price." };
      }
      const sharedMarketplace = marketplaces.find((marketplace) => variantIdsByMarketplace.get(marketplace.marketplace)?.has(entry.id));
      if (sharedMarketplace) {
        return { type: "same_marketplace" as const, label: `${relatedProduct.title} — ${entry.sku}`, href: `/catalog/${entry.id}`, detail: `Also active around ${sharedMarketplace.marketplace}.` };
      }
      return undefined;
    })
    .filter((item): item is ProductRelationship => Boolean(item))
    .slice(0, 4);
}

function buildRecommendation(params: {
  readiness: ProductReadiness;
  inventory: { available: number; incoming: number };
  finance: { margin: number; projectedRevenue: number };
  analytics: { unitsSold: number };
  supplier?: Supplier;
  liveMarketplaces: number;
  rejectedMarketplaces: number;
  inventoryDays?: number;
  faustScore: number;
  confidenceScore: number;
}) {
  const basis = ["readiness checklist", "inventory balances", "stored order history", "marketplace state"].filter((basisItem) => {
    if (basisItem === "stored order history") return params.analytics.unitsSold > 0;
    return true;
  });
  if (params.rejectedMarketplaces) {
    return {
      situation: "Marketplace expansion is blocked by listing review work.",
      reasoning: `${params.rejectedMarketplaces} marketplace draft(s) are rejected or need correction, so publishing more broadly could create failed sync work.`,
      expectedOutcome: "Fixing listing issues should improve marketplace coverage before you spend more time scaling this item.",
      confidence: params.confidenceScore / 100,
      confidenceBasis: basis,
    };
  }
  if (params.inventory.available <= 0) {
    return {
      situation: "This product has no sellable stock.",
      reasoning: params.supplier ? "Supplier context exists, so Faust can support reorder planning once you approve purchasing." : "Supplier context is missing, which limits reorder confidence.",
      expectedOutcome: "Receiving or purchasing inventory unlocks listing and sales workflows.",
      confidence: params.confidenceScore / 100,
      confidenceBasis: basis,
    };
  }
  if (params.inventory.available <= 2 || (params.inventoryDays !== undefined && params.inventoryDays <= 14)) {
    return {
      situation: "Sellable stock is getting thin.",
      reasoning: params.inventoryDays ? `At the stored sales pace, Faust estimates about ${params.inventoryDays} day(s) of inventory remaining.` : "Inventory is close to the reorder point and needs attention before scaling.",
      expectedOutcome: "Planning a reorder now lowers stockout risk while keeping the product available.",
      confidence: params.confidenceScore / 100,
      confidenceBasis: basis,
    };
  }
  if (params.readiness.score < 85) {
    return {
      situation: "This product is promising but not fully ready.",
      reasoning: `The readiness model is at ${params.readiness.score}/100; the next best action is ${params.readiness.nextAction.toLowerCase()}.`,
      expectedOutcome: "Completing the missing details should make marketplace publishing safer and cleaner.",
      confidence: params.confidenceScore / 100,
      confidenceBasis: basis,
    };
  }
  if (params.finance.margin >= 50 && params.liveMarketplaces < 3) {
    return {
      situation: "This product has room to expand.",
      reasoning: `Margin is strong at ${params.finance.margin.toFixed(1)}%, but it is live on only ${params.liveMarketplaces} marketplace(s).`,
      expectedOutcome: `Adding selected channel drafts could expose up to $${params.finance.projectedRevenue.toFixed(2)} in projected inventory revenue.`,
      confidence: params.confidenceScore / 100,
      confidenceBasis: basis,
    };
  }
  return {
    situation: "This product is operationally stable.",
    reasoning: `Faust Score is ${params.faustScore}/100 with current stock, margin, supplier, and marketplace signals aligned.`,
    expectedOutcome: "Monitor performance and prioritize higher-risk products first.",
    confidence: params.confidenceScore / 100,
    confidenceBasis: basis,
  };
}

function estimateInventoryDays(available: number, unitsSold: number) {
  if (!available || !unitsSold) return undefined;
  const dailyPace = unitsSold / 30;
  if (dailyPace <= 0) return undefined;
  return Math.max(1, Math.round(available / dailyPace));
}

function scoreInventory(available: number, reorderPoint: number, unitsSold: number) {
  if (available <= 0) return 10;
  if (available <= reorderPoint) return 45;
  if (unitsSold > 0) return 82;
  return 68;
}

function confidenceFromEvidence(params: { unitsSold: number; supplierKnown: boolean; liveMarketplaces: number; readinessScore: number }) {
  let score = 42;
  if (params.supplierKnown) score += 15;
  if (params.unitsSold > 0) score += 18;
  if (params.unitsSold >= 5) score += 8;
  if (params.liveMarketplaces > 0) score += 10;
  if (params.readinessScore >= 85) score += 7;
  return Math.round(clamp(score, 30, 96));
}

function faustScoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 78) return "Strong";
  if (score >= 65) return "Healthy";
  if (score >= 45) return "Needs work";
  return "At risk";
}

function faustScoreExplanation(score: number) {
  if (score >= 90) return "This product is one of the strongest operating assets in the portfolio.";
  if (score >= 78) return "This product has strong fundamentals and clear next actions.";
  if (score >= 65) return "This product is usable, but a few signals still limit confidence.";
  if (score >= 45) return "This product can improve with readiness, inventory, or marketplace work.";
  return "This product needs attention before Faust can confidently recommend scaling it.";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
