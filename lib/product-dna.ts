import type { ProductExperience } from "@/lib/product-experience";

export type ProductDnaStage = "initial" | "forming" | "developing" | "strong" | "established";

export type ProductDnaProfile = {
  productId: string;
  strengthScore: number;
  stage: ProductDnaStage;
  stageLabel: "Initial" | "Forming" | "Developing" | "Strong" | "Established";
  explanation: string;
  confidenceBreakdown: {
    identity: number;
    images: number;
    pricing: number;
    supplier: number;
    inventory: number;
    marketplace: number;
    sales: number;
    history: number;
  };
  strongestSignal: string | null;
  weakestSignal: string | null;
  recommendedNextStep: string | null;
  missingInputs: string[];
  calculatedAt: string;
  calculationVersion: "faust-product-dna-core-v1";
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stageFor(score: number): ProductDnaProfile["stage"] {
  if (score <= 20) return "initial";
  if (score <= 40) return "forming";
  if (score <= 60) return "developing";
  if (score <= 80) return "strong";
  return "established";
}

function stageLabel(stage: ProductDnaStage): ProductDnaProfile["stageLabel"] {
  if (stage === "initial") return "Initial";
  if (stage === "forming") return "Forming";
  if (stage === "developing") return "Developing";
  if (stage === "strong") return "Strong";
  return "Established";
}

function signalName(key: keyof ProductDnaProfile["confidenceBreakdown"]) {
  return {
    identity: "Product identity",
    images: "Image library",
    pricing: "Pricing confidence",
    supplier: "Supplier context",
    inventory: "Inventory signal",
    marketplace: "Marketplace readiness",
    sales: "Sales history",
    history: "Product memory",
  }[key];
}

export function buildProductDnaProfile(item: ProductExperience, calculatedAt = new Date().toISOString()): ProductDnaProfile {
  const imageCount = item.product.images?.length || (item.image ? 1 : 0);
  const liveMarketplaces = item.marketplaces.filter((marketplace) => marketplace.status === "live").length;
  const marketplaceProgress = item.marketplaces.filter((marketplace) => marketplace.status === "live" || marketplace.status === "draft").length;
  const identity = [
    item.product.title,
    item.variant.sku,
    item.product.category,
    item.variant.condition,
    item.product.description,
    item.product.brand || item.product.tags?.length,
  ].filter(Boolean).length / 6 * 100;
  const images = Math.min(100, imageCount / 5 * 100);
  const pricing = item.variant.defaultSalePrice > 0 && item.variant.landedUnitCost > 0
    ? Math.min(100, 52 + Math.max(0, Math.min(40, item.finance.margin)))
    : item.variant.defaultSalePrice > 0 || item.variant.landedUnitCost > 0
      ? 35
      : 0;
  const supplier = item.supplierName !== "Supplier not linked"
    ? Math.min(100, 58 + (item.purchasing.purchasingHistory ? 18 : 0) + (/unknown/i.test(item.purchasing.leadTime) ? 0 : 14))
    : 0;
  const inventory = item.inventory.onHand || item.inventory.incoming || item.inventory.available
    ? Math.min(100, 44 + Math.min(38, item.inventory.available * 6) + (item.inventory.value > 0 ? 18 : 0))
    : 0;
  const marketplace = Math.min(100, marketplaceProgress / Math.max(1, item.marketplaces.length) * 72 + liveMarketplaces * 9);
  const sales = item.analytics.unitsSold ? Math.min(100, 42 + item.analytics.unitsSold * 12 + (item.finance.revenue ? 16 : 0)) : 0;
  const history = Math.min(100, item.timeline.length / 8 * 100);
  const confidenceBreakdown = {
    identity: clampScore(identity),
    images: clampScore(images),
    pricing: clampScore(pricing),
    supplier: clampScore(supplier),
    inventory: clampScore(inventory),
    marketplace: clampScore(marketplace),
    sales: clampScore(sales),
    history: clampScore(history),
  };
  const strengthScore = clampScore(
    confidenceBreakdown.identity * 0.15
    + confidenceBreakdown.images * 0.1
    + confidenceBreakdown.pricing * 0.15
    + confidenceBreakdown.supplier * 0.1
    + confidenceBreakdown.inventory * 0.15
    + confidenceBreakdown.marketplace * 0.15
    + confidenceBreakdown.sales * 0.15
    + confidenceBreakdown.history * 0.05,
  );
  const ranked = (Object.entries(confidenceBreakdown) as [keyof ProductDnaProfile["confidenceBreakdown"], number][])
    .sort((a, b) => b[1] - a[1]);
  const weak = [...ranked].reverse().filter(([, score]) => score < 70);
  const weakWithRequiredImageSignal = confidenceBreakdown.images < 70 && !weak.some(([key]) => key === "images")
    ? [...weak, ["images", confidenceBreakdown.images] as [keyof ProductDnaProfile["confidenceBreakdown"], number]]
    : weak;
  const prioritizedWeak = confidenceBreakdown.images < 70 || confidenceBreakdown.pricing < 70
    ? [
        ...weakWithRequiredImageSignal.filter(([key]) => key === "images"),
        ...weakWithRequiredImageSignal.filter(([key]) => key === "pricing"),
        ...weakWithRequiredImageSignal.filter(([key]) => key !== "images" && key !== "pricing"),
      ]
    : weakWithRequiredImageSignal;
  const missingInputs = prioritizedWeak.slice(0, 4).map(([key]) => {
    if (key === "identity") return "Complete product identity fields";
    if (key === "images") return "Add more product photos";
    if (key === "pricing") return "Complete pricing and cost assumptions";
    if (key === "supplier") return "Record supplier lead time";
    if (key === "inventory") return "Receive or commit inventory";
    if (key === "marketplace") return "Validate marketplace listings";
    if (key === "sales") return "Build first sales history";
    return "Add more product activity";
  });
  const stage = stageFor(strengthScore);
  const weakestSignal = weak[0] ? signalName(weak[0][0]) : null;
  const strongestSignal = ranked[0] ? signalName(ranked[0][0]) : null;
  const recommendedNextStep = missingInputs[0] || "Keep monitoring product performance";

  return {
    productId: item.product.id,
    strengthScore,
    stage,
    stageLabel: stageLabel(stage),
    explanation: `${stageLabel(stage)} Product DNA: Faust's strongest signal is ${strongestSignal?.toLowerCase() || "still forming"}. ${weakestSignal ? `${weakestSignal} is the next area to strengthen.` : "The product has a well-rounded operating profile."}`,
    confidenceBreakdown,
    strongestSignal,
    weakestSignal,
    recommendedNextStep,
    missingInputs,
    calculatedAt,
    calculationVersion: "faust-product-dna-core-v1",
  };
}
