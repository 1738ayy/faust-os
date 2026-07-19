import type { OperatingData, Product, Variant } from "@/domain/business";
import { availableUnits } from "@/lib/business-calculations";

export type ReadinessStatus = "needs_work" | "incomplete" | "almost_ready" | "ready" | "published_everywhere" | "needs_details" | "waiting_for_inventory" | "needs_photos" | "needs_pricing_review" | "live";
export type ReadinessDimensionKey = "photos" | "pricing" | "supplier" | "inventory" | "marketplace_category" | "seo" | "description" | "shipping_profile" | "cost_validation" | "margin_validation" | "marketplace_compliance";
export type ReadinessDimension = { key: ReadinessDimensionKey; label: string; ready: boolean; detail: string };

export type ProductReadiness = {
  status: ReadinessStatus;
  score: number;
  missing: string[];
  nextAction: string;
  dimensions: ReadinessDimension[];
};

export function getProductReadiness(data: OperatingData, variant: Variant, product?: Product): ProductReadiness {
  const balances = data.balances.filter((balance) => balance.variantId === variant.id);
  const available = balances.reduce((sum, balance) => sum + availableUnits(balance), 0);
  const listings = data.channelListingDrafts?.filter((draft) => draft.variantId === variant.id) || [];
  const publishedCount = listings.filter((draft) => draft.status === "published").length;
  const marketplaces = new Set(listings.map((draft) => draft.marketplace));
  const supplier = data.suppliers.find((entry) => entry.id === product?.supplierId);
  const projectedMargin = variant.defaultSalePrice ? (variant.defaultSalePrice - variant.landedUnitCost) / variant.defaultSalePrice * 100 : 0;
  const hasPhotos = Boolean(product?.image) || listings.some((draft) => draft.imageUrls.length);
  const hasCategory = Boolean(product?.category) || listings.some((draft) => draft.category);
  const hasDescription = listings.some((draft) => draft.description.length > 40);
  const hasMarketplaceCompliance = listings.length > 0 && listings.every((draft) => draft.validationErrors.length === 0);
  const hasShippingProfile = Boolean(variant.weightOz) || listings.some((draft) => draft.attributes.shipping || draft.attributes.shippingProfile);
  const hasSeo = listings.some((draft) => draft.title.length >= 30 && draft.description.length >= 80);
  const hasCost = Boolean(variant.landedUnitCost && variant.landedUnitCost > 0);
  const hasPrice = Boolean(variant.defaultSalePrice && variant.defaultSalePrice > 0);

  const dimensions: ReadinessDimension[] = [
    { key: "photos", label: "Photos", ready: hasPhotos, detail: hasPhotos ? "Primary image or draft images are present." : "Add product and listing photos." },
    { key: "pricing", label: "Pricing", ready: hasPrice, detail: hasPrice ? `Default price is $${variant.defaultSalePrice.toFixed(2)}.` : "Set the target selling price." },
    { key: "supplier", label: "Supplier", ready: Boolean(supplier), detail: supplier ? supplier.name : "Link the supplier." },
    { key: "inventory", label: "Inventory", ready: available > 0, detail: `${available} sellable unit(s) available.` },
    { key: "marketplace_category", label: "Marketplace category", ready: hasCategory, detail: hasCategory ? "Product or draft category is present." : "Choose a marketplace-ready category." },
    { key: "seo", label: "SEO", ready: hasSeo, detail: hasSeo ? "Draft title/description have enough marketplace detail." : "Improve title and description depth." },
    { key: "description", label: "Description", ready: hasDescription || Boolean(product?.title), detail: hasDescription ? "Marketplace description is ready." : "Complete product description." },
    { key: "shipping_profile", label: "Shipping profile", ready: hasShippingProfile, detail: hasShippingProfile ? "Weight or shipping profile exists." : "Add weight or shipping profile." },
    { key: "cost_validation", label: "Cost validation", ready: hasCost, detail: hasCost ? `Landed cost is $${variant.landedUnitCost.toFixed(2)}.` : "Validate landed cost." },
    { key: "margin_validation", label: "Margin validation", ready: hasPrice && hasCost && projectedMargin >= 35, detail: hasPrice && hasCost ? `${projectedMargin.toFixed(1)}% projected margin.` : "Needs price and cost first." },
    { key: "marketplace_compliance", label: "Marketplace compliance", ready: hasMarketplaceCompliance, detail: hasMarketplaceCompliance ? "Drafts have no validation errors." : "Fix draft validation issues." },
  ];
  const missing = dimensions.filter((dimension) => !dimension.ready).map((dimension) => dimension.label.toLowerCase());
  const score = Math.round(dimensions.filter((dimension) => dimension.ready).length / dimensions.length * 100);

  if (publishedCount >= 5) return { status: "published_everywhere", score: 100, missing: [], nextAction: "Monitor marketplace performance", dimensions };
  if (publishedCount > 0) return { status: "live", score: Math.max(80, score), missing, nextAction: "Review marketplace health", dimensions };
  if (available <= 0) return { status: "waiting_for_inventory", score: Math.max(18, score), missing, nextAction: "Receive inventory", dimensions };
  if (!hasPhotos) return { status: "needs_photos", score: Math.max(28, score), missing, nextAction: "Add listing photos", dimensions };
  if (!hasPrice || !hasCost || projectedMargin < 35) return { status: "needs_pricing_review", score: Math.max(35, score), missing, nextAction: "Review pricing", dimensions };
  if (missing.length >= 5) return { status: "needs_work", score, missing, nextAction: "Complete product basics", dimensions };
  if (missing.length >= 3) return { status: "incomplete", score, missing, nextAction: "Complete readiness checklist", dimensions };
  if (missing.length) return { status: "almost_ready", score, missing, nextAction: "Finish final listing details", dimensions };
  if (marketplaces.size < 5) return { status: "ready", score: Math.max(92, score), missing: [], nextAction: "Generate marketplace drafts", dimensions };
  return { status: "ready", score: Math.max(95, score), missing: [], nextAction: "Publish selected marketplaces", dimensions };
}

export function readinessLabel(status: ReadinessStatus) {
  const labels: Record<ReadinessStatus, string> = {
    needs_work: "Needs work",
    incomplete: "Incomplete",
    almost_ready: "Almost ready",
    ready: "Ready to list",
    needs_details: "Needs details",
    waiting_for_inventory: "Waiting for inventory",
    needs_photos: "Needs photos",
    needs_pricing_review: "Needs pricing review",
    live: "Live",
    published_everywhere: "Published everywhere",
  };
  return labels[status];
}

export function readinessTone(status: ReadinessStatus) {
  if (status === "published_everywhere") return "blue";
  if (status === "live" || status === "ready") return "green";
  if (status === "almost_ready") return "yellow";
  if (status === "incomplete" || status === "needs_details" || status === "needs_photos" || status === "needs_pricing_review" || status === "waiting_for_inventory") return "orange";
  return "red";
}
