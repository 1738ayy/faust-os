export type MarketplaceId = "depop" | "mercari" | "poshmark" | "shopify" | "etsy" | "ebay";

export type Marketplace = {
  id: MarketplaceId;
  name: string;
  sellingFeeRate: number;
  paymentFeeRate: number;
};

export type ListingStatus = "draft" | "listed" | "sold" | "archived";

export type MarketplaceListing = {
  marketplaceId: MarketplaceId;
  title: string;
  description: string;
  category: string;
  tags: string[];
  shippingMethod: string;
  shippingPrice: number;
  status: ListingStatus;
};
