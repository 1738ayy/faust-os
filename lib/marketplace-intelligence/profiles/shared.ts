import { baseFieldDefinitions, category, enumMap } from "../mappings";
import type { MarketplaceAccountDefaults, MarketplaceCapabilities, MarketplaceContentRules, MarketplaceFieldDefinition, MarketplaceIntelligenceProfile, MarketplacePricingRules, MarketplaceShippingRules, MarketplaceSlug, MarketplaceSyncRules } from "../types";

export const effectiveAt = "2026-07-23T00:00:00.000Z";

export const defaultAccountDefaults: MarketplaceAccountDefaults = {
  shippingService: "usps_ground",
  handlingTimeDays: 2,
  returnPolicy: "marketplace_default",
  defaultCondition: "excellent",
  defaultLocation: "Default warehouse",
  priceAdjustmentPercent: 0,
  descriptionFooter: "Ships from Faust OS inventory.",
  tags: [],
  autoOfferEnabled: false,
  bundleDiscountPercent: 0,
};

export function field(key: string, patch: Partial<MarketplaceFieldDefinition> = {}) {
  const base = baseFieldDefinitions.find((definition) => definition.key === key);
  if (!base) throw new Error(`Unknown marketplace field ${key}`);
  return { ...base, ...patch };
}

export function commonProfile(input: {
  marketplace: MarketplaceSlug;
  displayName: MarketplaceIntelligenceProfile["displayName"];
  profileVersion: string;
  ruleConfidence?: MarketplaceIntelligenceProfile["ruleConfidence"];
  capabilityNotes?: string[];
  capabilities: MarketplaceCapabilities;
  fields?: MarketplaceFieldDefinition[];
  categories: MarketplaceIntelligenceProfile["categories"];
  enums?: MarketplaceIntelligenceProfile["enums"];
  imageRules: MarketplaceIntelligenceProfile["imageRules"];
  shippingRules: MarketplaceShippingRules;
  pricingRules: MarketplacePricingRules;
  contentRules: MarketplaceContentRules;
  syncRules: MarketplaceSyncRules;
  riskRules: MarketplaceIntelligenceProfile["riskRules"];
  operationalLimits: MarketplaceIntelligenceProfile["operationalLimits"];
  accountDefaults?: Partial<MarketplaceAccountDefaults>;
}): MarketplaceIntelligenceProfile {
  const fieldDefinitions = input.fields || baseFieldDefinitions;
  return {
    marketplace: input.marketplace,
    displayName: input.displayName,
    profileVersion: input.profileVersion,
    effectiveAt,
    status: "active",
    ruleConfidence: input.ruleConfidence || "mixed",
    capabilityNotes: input.capabilityNotes || ["Sandbox and extension rules are modeled from Faust internal fixtures; live marketplace policies still require credential-backed verification."],
    capabilities: input.capabilities,
    requirements: {
      required: fieldDefinitions.filter((item) => item.importance === "required").map((item) => item.key),
      conditionallyRequired: fieldDefinitions.filter((item) => item.importance === "conditionally_required").map((item) => ({ field: item.key, requiredWhen: item.requiredWhen || [] })),
      recommended: fieldDefinitions.filter((item) => item.importance === "recommended").map((item) => item.key),
      optional: fieldDefinitions.filter((item) => item.importance === "optional").map((item) => item.key),
      unsupported: fieldDefinitions.filter((item) => item.importance === "unsupported").map((item) => item.key),
    },
    fieldDefinitions,
    mappings: {
      fields: Object.fromEntries(fieldDefinitions.map((item) => [item.key, item.key === "sku" && input.marketplace === "depop" ? "externalSku" : item.key])),
      provenanceLabels: Object.fromEntries(fieldDefinitions.map((item) => [item.key, item.label])),
    },
    categories: input.categories,
    enums: input.enums || enumMap({}),
    imageRules: input.imageRules,
    shippingRules: input.shippingRules,
    pricingRules: input.pricingRules,
    contentRules: input.contentRules,
    riskRules: input.riskRules,
    syncRules: input.syncRules,
    operationalLimits: input.operationalLimits,
    accountDefaults: { ...defaultAccountDefaults, ...input.accountDefaults },
  };
}

export const commonCategories = {
  depop: [
    category("apparel.tops.tshirts", "clothing", "depop-menswear-tshirts", ["Menswear", "Tops", "T-Shirts"], "verified", 0.92),
    category("apparel.tops.hoodies", "clothing", "depop-menswear-hoodies", ["Menswear", "Tops", "Hoodies"], "verified", 0.92),
    category("apparel.bottoms.jeans", "clothing", "depop-menswear-jeans", ["Menswear", "Bottoms", "Jeans"], "inferred", 0.78),
    category("apparel.shoes.sneakers", "shoes", "depop-shoes-sneakers", ["Shoes", "Sneakers"], "inferred", 0.78),
    category("jewelry.necklaces", "jewelry", "depop-accessories-jewelry", ["Accessories", "Jewelry"], "verified", 0.9),
    category("jewelry.bracelets", "jewelry", "depop-accessories-jewelry", ["Accessories", "Jewelry"], "verified", 0.88),
    category("bags.handbags", "bags", "depop-accessories-bags", ["Accessories", "Bags"], "inferred", 0.75),
    category("collectibles.general", "collectibles", null, [], "missing", 0),
  ],
  ebay: [
    category("apparel.tops.tshirts", "clothing", "ebay-mens-tshirts", ["Clothing, Shoes & Accessories", "Men", "Men's Clothing", "Shirts"], "verified", 0.9),
    category("apparel.tops.hoodies", "clothing", "ebay-mens-hoodies", ["Clothing, Shoes & Accessories", "Men", "Men's Clothing", "Hoodies & Sweatshirts"], "verified", 0.94),
    category("apparel.bottoms.jeans", "clothing", "ebay-mens-jeans", ["Clothing, Shoes & Accessories", "Men", "Men's Clothing", "Jeans"], "verified", 0.9),
    category("apparel.shoes.sneakers", "shoes", "ebay-mens-sneakers", ["Clothing, Shoes & Accessories", "Men", "Men's Shoes", "Athletic Shoes"], "verified", 0.86),
    category("jewelry.necklaces", "jewelry", "ebay-jewelry-necklaces", ["Jewelry & Watches", "Fashion Jewelry", "Necklaces & Pendants"], "verified", 0.9),
    category("jewelry.bracelets", "jewelry", "ebay-jewelry-bracelets", ["Jewelry & Watches", "Fashion Jewelry", "Bracelets & Charms"], "verified", 0.9),
    category("bags.handbags", "bags", "ebay-handbags", ["Clothing, Shoes & Accessories", "Women", "Women's Bags & Handbags"], "verified", 0.82),
    category("collectibles.general", "collectibles", "ebay-collectibles", ["Collectibles"], "inferred", 0.74),
  ],
  etsy: [
    category("apparel.tops.tshirts", "clothing", "etsy-clothing-shirts", ["Clothing", "Gender-Neutral Adult Clothing", "Tops & Tees"], "inferred", 0.76),
    category("apparel.tops.hoodies", "clothing", "etsy-clothing-hoodies", ["Clothing", "Gender-Neutral Adult Clothing", "Hoodies"], "inferred", 0.74),
    category("apparel.bottoms.jeans", "clothing", "etsy-clothing-pants", ["Clothing", "Gender-Neutral Adult Clothing", "Pants"], "inferred", 0.72),
    category("apparel.shoes.sneakers", "shoes", "etsy-shoes-sneakers", ["Shoes", "Sneakers"], "inferred", 0.7),
    category("jewelry.necklaces", "jewelry", "etsy-jewelry-necklaces", ["Jewelry", "Necklaces"], "verified", 0.9),
    category("jewelry.bracelets", "jewelry", "etsy-jewelry-bracelets", ["Jewelry", "Bracelets"], "verified", 0.9),
    category("bags.handbags", "bags", "etsy-bags-purses", ["Bags & Purses", "Handbags"], "verified", 0.8),
    category("collectibles.general", "collectibles", "etsy-collectibles", ["Art & Collectibles", "Collectibles"], "inferred", 0.7),
  ],
  mercari: [
    category("apparel.tops.tshirts", "clothing", "mercari-men-tshirts", ["Men", "Tops", "T-Shirts"], "verified", 0.9),
    category("apparel.tops.hoodies", "clothing", "mercari-men-hoodies", ["Men", "Tops", "Hoodies"], "verified", 0.9),
    category("apparel.bottoms.jeans", "clothing", "mercari-men-jeans", ["Men", "Pants", "Jeans"], "verified", 0.85),
    category("apparel.shoes.sneakers", "shoes", "mercari-men-shoes", ["Men", "Shoes", "Athletic"], "inferred", 0.75),
    category("jewelry.necklaces", "jewelry", "mercari-jewelry-necklaces", ["Women", "Jewelry", "Necklaces"], "inferred", 0.74),
    category("jewelry.bracelets", "jewelry", "mercari-jewelry-bracelets", ["Women", "Jewelry", "Bracelets"], "inferred", 0.74),
    category("bags.handbags", "bags", "mercari-bags-handbags", ["Women", "Bags", "Handbags"], "inferred", 0.72),
    category("collectibles.general", "collectibles", "mercari-collectibles", ["Collectibles"], "verified", 0.82),
  ],
  poshmark: [
    category("apparel.tops.tshirts", "clothing", "posh-men-tees", ["Men", "Shirts", "Tees"], "verified", 0.9),
    category("apparel.tops.hoodies", "clothing", "posh-men-hoodies", ["Men", "Shirts", "Sweatshirts & Hoodies"], "verified", 0.86),
    category("apparel.bottoms.jeans", "clothing", "posh-men-jeans", ["Men", "Jeans"], "verified", 0.86),
    category("apparel.shoes.sneakers", "shoes", "posh-men-sneakers", ["Men", "Shoes", "Sneakers"], "verified", 0.82),
    category("jewelry.necklaces", "jewelry", "posh-women-necklaces", ["Women", "Jewelry", "Necklaces"], "verified", 0.84),
    category("jewelry.bracelets", "jewelry", "posh-women-bracelets", ["Women", "Jewelry", "Bracelets"], "verified", 0.84),
    category("bags.handbags", "bags", "posh-women-handbags", ["Women", "Bags", "Handbags"], "verified", 0.84),
    category("collectibles.general", "collectibles", null, [], "missing", 0),
  ],
};
