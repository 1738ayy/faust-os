import type { Marketplace, MarketplaceId } from "@/types/marketplace";

export const marketplaces: Marketplace[] = [
  { id: "depop", name: "Depop", sellingFeeRate: 0, paymentFeeRate: 0.029 },
  { id: "mercari", name: "Mercari", sellingFeeRate: 0.1, paymentFeeRate: 0.029 },
  { id: "poshmark", name: "Poshmark", sellingFeeRate: 0.2, paymentFeeRate: 0 },
  { id: "shopify", name: "Shopify", sellingFeeRate: 0, paymentFeeRate: 0.029 },
  { id: "etsy", name: "Etsy", sellingFeeRate: 0.065, paymentFeeRate: 0.03 },
  { id: "ebay", name: "eBay", sellingFeeRate: 0.1325, paymentFeeRate: 0.0299 },
];

export function getMarketplace(id: MarketplaceId): Marketplace {
  return marketplaces.find((marketplace) => marketplace.id === id) ?? marketplaces[0];
}
