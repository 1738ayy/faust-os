import type { Costs } from "@/types/cost";
import type { Opportunity } from "@/types/opportunity";
import type { Product } from "@/types/product";
import type { SuperbuyProduct } from "@/types/superbuy-product";
import type { MarketplaceId } from "@/types/marketplace";
import { getMarketplace } from "../marketplaces";

const COST_LABELS = {
  product: "Product Cost",
  domesticShipping: "Domestic China Shipping",
  internationalShipping: "International Shipping",
  packaging: "Packaging",
  marketplaceFees: "Marketplace Fees",
  paymentProcessing: "Payment Processing",
  advertising: "Advertising",
  taxes: "Taxes",
  storage: "Storage Cost",
  warehouse: "Warehouse Cost",
  returns: "Expected Returns",
  miscellaneous: "Miscellaneous",
} as const;

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

export function buildOpportunity(source: SuperbuyProduct, options: { targetMargin?: number; marketplaceId?: MarketplaceId } = {}): Opportunity {
  const now = new Date().toISOString();
  const product = buildProduct(source);
  const marketplaceId = options.marketplaceId || "depop";
  const marketplace = getMarketplace(marketplaceId);
  const editableCost = (source.price ?? 0) + (source.domesticShipping ?? 0) + (source.internationalShipping ?? 0);
  const targetMargin = Math.max(0, Math.min(95, options.targetMargin ?? 50)) / 100;
  const feeRate = marketplace.sellingFeeRate + marketplace.paymentFeeRate;
  const targetPrice = 1 - feeRate - targetMargin > 0 ? editableCost / (1 - feeRate - targetMargin) : editableCost * 3;

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
    salePrice: Math.round(targetPrice * 100) / 100,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}
