import type { Costs } from "@/types/cost";
import type { Opportunity } from "@/types/opportunity";
import type { Product } from "@/types/product";
import type { SuperbuyProduct } from "@/types/superbuy-product";
import type { MarketplaceId } from "@/types/marketplace";
import { estimateMarketplaceFees, getMarketplaceFeeProfile } from "../marketplace-fee-profiles";

const COST_LABELS = {
  product: "Product Cost",
  domesticShipping: "Domestic China Shipping",
  internationalShipping: "International Shipping",
  packaging: "Packaging",
  marketplaceFees: "Marketplace Fees",
  paymentProcessing: "Payment Processing",
  advertising: "Promotion Cost",
  taxes: "Taxes",
  storage: "Storage Cost",
  warehouse: "Warehouse Cost",
  returns: "Expected Returns",
  miscellaneous: "Miscellaneous",
} as const;

function skuPart(value?: string) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12)
    .toUpperCase();
}

function suggestedSku(source: SuperbuyProduct) {
  const category = skuPart(source.category || source.subcategory || "SKU");
  const supplier = skuPart(source.storeName || source.supplier || "SRC");
  const title = skuPart(source.title);
  const suffix = skuPart(source.original1688Url?.match(/offer\/(\d+)/)?.[1] || source.superbuyUrl.match(/offer%2F(\d+)/i)?.[1] || source.superbuyUrl || source.title || crypto.randomUUID()).slice(-6);
  return ["FST", category, supplier || title || "ITEM", suffix].filter(Boolean).join("-").slice(0, 64);
}

function buildCosts(productCost = 0, domesticShipping = 0, internationalShipping = 0): Costs {
  return Object.fromEntries(
    Object.entries(COST_LABELS).map(([key, label]) => [
      key,
      {
        key,
        label,
        amount: key === "product" ? productCost : key === "domesticShipping" ? domesticShipping : key === "internationalShipping" ? internationalShipping : 0,
        calculated: key === "marketplaceFees" || key === "paymentProcessing",
      },
    ])
  ) as Costs;
}

export function buildProduct(source: SuperbuyProduct): Product {
  return {
    id: crypto.randomUUID(),
    sku: suggestedSku(source),
    name: source.title,
    category: source.category,
    subcategory: source.subcategory,
    description: source.description,
    material: source.material,
    dimensions: source.dimensions,
    weight: source.weight,
    shippingWeight: source.shippingWeight,
    packageSize: source.packageSize,
    packageInfo: source.packageInfo,
    supplier: {
      name: source.supplier,
      storeName: source.storeName,
      storeUrl: source.supplierStoreUrl,
      factoryName: source.factoryName,
    },
    sourcing: {
      superbuyUrl: source.superbuyUrl,
      original1688Url: source.original1688Url,
      sourcePrice: source.price,
      sourcePriceRange: source.priceRange,
      stock: source.stock,
      minimumOrderQuantity: source.minimumOrderQuantity,
    },
    media: { images: source.images },
    variants: source.variants,
    source,
  };
}

export function buildOpportunity(source: SuperbuyProduct, options: { targetMargin?: number; marketplaceId?: MarketplaceId; depopBoostEnabledByDefault?: boolean; depopBoostRate?: number } = {}): Opportunity {
  const now = new Date().toISOString();
  const product = buildProduct(source);
  const marketplaceId = options.marketplaceId || "depop";
  const editableCost = (source.price ?? 0) + (source.domesticShipping ?? 0) + (source.internationalShipping ?? 0);
  const targetMargin = Math.max(0, Math.min(95, options.targetMargin ?? 50)) / 100;
  const feeAssumptions = {
    marketplaceId,
    profileVersion: getMarketplaceFeeProfile(marketplaceId).version,
    overrides: marketplaceId === "depop" ? { depop_boost: { enabled: options.depopBoostEnabledByDefault ?? true, rate: (options.depopBoostRate ?? 12) / 100 } } : undefined,
  };
  const fees = estimateMarketplaceFees(marketplaceId, { itemPrice: 0, shippingPrice: 0 }, feeAssumptions);
  const feeRate = fees.estimates.filter((estimate) => estimate.rate && estimate.enabled).reduce((sum, estimate) => sum + (estimate.rate || 0), 0);
  const flatFees = fees.estimates.filter((estimate) => !estimate.rate && estimate.enabled).reduce((sum, estimate) => sum + estimate.amount, 0);
  const targetPrice = 1 - feeRate - targetMargin > 0 ? (editableCost + flatFees) / (1 - feeRate - targetMargin) : editableCost * 3;

  return {
    id: crypto.randomUUID(),
    product,
    costs: buildCosts(source.price, source.domesticShipping, source.internationalShipping),
    listing: {
      marketplaceId,
      title: product.name,
      description: product.description ?? "",
      category: product.category ?? "",
      tags: [],
      shippingMethod: "",
      shippingPrice: 0,
      status: "draft",
    },
    feeAssumptions,
    salePrice: Math.round(targetPrice * 100) / 100,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}
