import type { MarketplaceId } from "@/types/marketplace";

export type FeeBase = "item_price" | "item_plus_shipping" | "order_total" | "per_item" | "per_order";
export type FeeRule = {
  key: string;
  label: string;
  type: "percentage" | "flat";
  rate?: number;
  amount?: number;
  base: FeeBase;
  optional?: boolean;
  defaultEnabled?: boolean;
  configurable?: boolean;
  note?: string;
};
export type MarketplaceFeeProfile = {
  marketplace: MarketplaceId;
  name: string;
  currency: "USD";
  version: string;
  effectiveFrom: string;
  sellingFee?: FeeRule;
  paymentProcessingFee?: FeeRule;
  promotionFee?: FeeRule;
  flatFees: FeeRule[];
  incomplete?: boolean;
  note?: string;
};
export type FeeOverride = { rate?: number; amount?: number; enabled?: boolean };
export type FeeAssumptions = {
  marketplaceId: MarketplaceId;
  profileVersion: string;
  overrides?: Record<string, FeeOverride>;
};
export type FeeEstimate = {
  key: string;
  label: string;
  rate?: number;
  amount: number;
  base: FeeBase;
  enabled: boolean;
  optional: boolean;
  overridden: boolean;
  note?: string;
};

const profiles: MarketplaceFeeProfile[] = [
  {
    marketplace: "depop",
    name: "Depop",
    currency: "USD",
    version: "depop-us-2026-07",
    effectiveFrom: "2026-07-01",
    sellingFee: { key: "selling_fee", label: "Selling Fee", type: "percentage", rate: 0.1, base: "item_plus_shipping", configurable: true, note: "Estimated Depop selling fee on sale price plus buyer-paid shipping." },
    paymentProcessingFee: { key: "payment_processing", label: "Payment Processing Fee", type: "percentage", rate: 0.029, base: "item_plus_shipping", configurable: true, note: "Estimated payment processing percentage. Actual fees should be reconciled in Finance after sale." },
    promotionFee: { key: "depop_boost", label: "Depop Boost", type: "percentage", rate: 0.12, base: "item_price", optional: true, defaultEnabled: true, configurable: true, note: "Optional Boost estimate. Turn off to model an unboosted listing." },
    flatFees: [],
  },
  {
    marketplace: "ebay",
    name: "eBay",
    currency: "USD",
    version: "ebay-us-2026-07",
    effectiveFrom: "2026-07-01",
    sellingFee: { key: "selling_fee", label: "Final Value Fee", type: "percentage", rate: 0.1325, base: "item_plus_shipping", configurable: true },
    paymentProcessingFee: { key: "payment_processing", label: "Payment Processing Fee", type: "percentage", rate: 0.0299, base: "item_plus_shipping", configurable: true },
    promotionFee: { key: "promoted_listing", label: "Promoted Listing", type: "percentage", rate: 0.05, base: "item_price", optional: true, defaultEnabled: false, configurable: true },
    flatFees: [{ key: "order_flat", label: "Per-order fee", type: "flat", amount: 0.3, base: "per_order", configurable: true }],
  },
  {
    marketplace: "etsy",
    name: "Etsy",
    currency: "USD",
    version: "etsy-us-2026-07",
    effectiveFrom: "2026-07-01",
    sellingFee: { key: "selling_fee", label: "Transaction Fee", type: "percentage", rate: 0.065, base: "item_plus_shipping", configurable: true },
    paymentProcessingFee: { key: "payment_processing", label: "Payment Processing Fee", type: "percentage", rate: 0.03, base: "item_plus_shipping", configurable: true },
    promotionFee: { key: "etsy_ads", label: "Etsy Ads", type: "percentage", rate: 0.05, base: "item_price", optional: true, defaultEnabled: false, configurable: true },
    flatFees: [{ key: "listing_fee", label: "Listing Fee", type: "flat", amount: 0.2, base: "per_item", configurable: true }],
  },
  {
    marketplace: "mercari",
    name: "Mercari",
    currency: "USD",
    version: "mercari-us-2026-07",
    effectiveFrom: "2026-07-01",
    sellingFee: { key: "selling_fee", label: "Selling Fee", type: "percentage", rate: 0.1, base: "item_price", configurable: true },
    paymentProcessingFee: { key: "payment_processing", label: "Payment Processing Fee", type: "percentage", rate: 0.029, base: "item_plus_shipping", configurable: true },
    promotionFee: { key: "smart_pricing", label: "Promotion Cost", type: "percentage", rate: 0.04, base: "item_price", optional: true, defaultEnabled: false, configurable: true },
    flatFees: [],
  },
  {
    marketplace: "poshmark",
    name: "Poshmark",
    currency: "USD",
    version: "poshmark-us-2026-07",
    effectiveFrom: "2026-07-01",
    sellingFee: { key: "selling_fee", label: "Selling Fee", type: "percentage", rate: 0.2, base: "item_price", configurable: true },
    paymentProcessingFee: undefined,
    promotionFee: undefined,
    flatFees: [],
  },
  {
    marketplace: "shopify",
    name: "Shopify",
    currency: "USD",
    version: "shopify-us-2026-07",
    effectiveFrom: "2026-07-01",
    sellingFee: { key: "selling_fee", label: "Platform Fee", type: "percentage", rate: 0, base: "item_price", configurable: true },
    paymentProcessingFee: { key: "payment_processing", label: "Payment Processing Fee", type: "percentage", rate: 0.029, base: "item_plus_shipping", configurable: true },
    promotionFee: undefined,
    flatFees: [{ key: "order_flat", label: "Per-order fee", type: "flat", amount: 0.3, base: "per_order", configurable: true }],
  },
];

export function marketplaceFeeProfiles() {
  return profiles;
}

export function getMarketplaceFeeProfile(marketplaceId: MarketplaceId) {
  return profiles.find((profile) => profile.marketplace === marketplaceId) || {
    marketplace: marketplaceId,
    name: marketplaceId,
    currency: "USD" as const,
    version: `${marketplaceId}-incomplete`,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    flatFees: [],
    incomplete: true,
    note: "Marketplace fee profile incomplete. Configure temporary values before trusting profit.",
  };
}

function baseAmount(base: FeeBase, input: { itemPrice: number; shippingPrice: number; quantity?: number }) {
  if (base === "item_plus_shipping" || base === "order_total") return input.itemPrice + input.shippingPrice;
  if (base === "per_item") return input.quantity || 1;
  if (base === "per_order") return 1;
  return input.itemPrice;
}

export function estimateFee(rule: FeeRule, input: { itemPrice: number; shippingPrice: number; quantity?: number }, override?: FeeOverride): FeeEstimate {
  const enabled = rule.optional ? override?.enabled ?? rule.defaultEnabled ?? false : true;
  const rate = override?.rate ?? rule.rate;
  const flat = override?.amount ?? rule.amount;
  const amount = enabled ? rule.type === "percentage" ? baseAmount(rule.base, input) * (rate || 0) : flat || 0 : 0;
  return {
    key: rule.key,
    label: rule.label,
    rate,
    amount: Math.round(amount * 100) / 100,
    base: rule.base,
    enabled,
    optional: Boolean(rule.optional),
    overridden: override?.rate !== undefined || override?.amount !== undefined || override?.enabled !== undefined,
    note: rule.note,
  };
}

export function estimateMarketplaceFees(marketplaceId: MarketplaceId, input: { itemPrice: number; shippingPrice: number; quantity?: number }, assumptions?: FeeAssumptions) {
  const profile = getMarketplaceFeeProfile(marketplaceId);
  const overrides = assumptions?.marketplaceId === marketplaceId ? assumptions.overrides || {} : {};
  const estimates = [
    profile.sellingFee ? estimateFee(profile.sellingFee, input, overrides[profile.sellingFee.key]) : undefined,
    profile.paymentProcessingFee ? estimateFee(profile.paymentProcessingFee, input, overrides[profile.paymentProcessingFee.key]) : undefined,
    profile.promotionFee ? estimateFee(profile.promotionFee, input, overrides[profile.promotionFee.key]) : undefined,
    ...profile.flatFees.map((rule) => estimateFee(rule, input, overrides[rule.key])),
  ].filter((estimate): estimate is FeeEstimate => Boolean(estimate));
  return {
    profile,
    estimates,
    marketplaceFees: estimates.filter((estimate) => estimate.key !== "payment_processing").reduce((sum, estimate) => sum + estimate.amount, 0),
    paymentProcessingFees: estimates.filter((estimate) => estimate.key === "payment_processing").reduce((sum, estimate) => sum + estimate.amount, 0),
    promotionFees: estimates.filter((estimate) => estimate.optional).reduce((sum, estimate) => sum + estimate.amount, 0),
    totalSellingCosts: estimates.reduce((sum, estimate) => sum + estimate.amount, 0),
  };
}
