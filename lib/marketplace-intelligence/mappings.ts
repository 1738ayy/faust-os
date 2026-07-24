import type { MarketplaceCategoryMapping, MarketplaceEnumMap, MarketplaceFieldDefinition, MarketplaceOption, UniversalCondition, UniversalGender } from "./types";

export const universalCategoryIds = [
  "apparel.tops.tshirts",
  "apparel.tops.hoodies",
  "apparel.bottoms.jeans",
  "apparel.shoes.sneakers",
  "jewelry.necklaces",
  "jewelry.bracelets",
  "bags.handbags",
  "collectibles.general",
] as const;

export type UniversalCategoryId = typeof universalCategoryIds[number];

export const universalCategoryLabels: Record<UniversalCategoryId, string> = {
  "apparel.tops.tshirts": "T-shirt",
  "apparel.tops.hoodies": "Hoodie",
  "apparel.bottoms.jeans": "Jeans",
  "apparel.shoes.sneakers": "Shoes",
  "jewelry.necklaces": "Necklace",
  "jewelry.bracelets": "Bracelet",
  "bags.handbags": "Handbag",
  "collectibles.general": "Collectible",
};

export function inferUniversalCategoryId(label?: string | null): UniversalCategoryId | null {
  const value = (label || "").toLowerCase();
  if (value.includes("hoodie")) return "apparel.tops.hoodies";
  if (value.includes("streetwear")) return "apparel.tops.tshirts";
  if (value.includes("shirt") || value.includes("tee") || value.includes("t-shirt") || value.includes("top")) return "apparel.tops.tshirts";
  if (value.includes("jean") || value.includes("pants")) return "apparel.bottoms.jeans";
  if (value.includes("shoe") || value.includes("sneaker")) return "apparel.shoes.sneakers";
  if (value.includes("necklace") || value.includes("chain")) return "jewelry.necklaces";
  if (value.includes("bracelet")) return "jewelry.bracelets";
  if (value.includes("bag") || value.includes("purse")) return "bags.handbags";
  if (value.includes("collect")) return "collectibles.general";
  return null;
}

export function option(value: string, label = value, verified = false): MarketplaceOption {
  return { value, label, verified };
}

export function enumMap(condition: Partial<Record<UniversalCondition, MarketplaceOption>>, extras?: Partial<MarketplaceEnumMap>): MarketplaceEnumMap {
  return {
    condition: {
      new_with_tags: condition.new_with_tags || option("New with tags", "New with tags", true),
      excellent: condition.excellent || option("Excellent", "Excellent"),
      good: condition.good || option("Good", "Good"),
      fair: condition.fair || option("Fair", "Fair"),
      like_new: condition.like_new || option("Like New", "Like New"),
      unknown: condition.unknown || option("Unspecified", "Unspecified"),
    },
    size: { XS: option("XS"), S: option("S"), M: option("M"), L: option("L"), XL: option("XL"), "One Size": option("One Size") },
    color: { black: option("Black"), white: option("White"), blue: option("Blue"), red: option("Red"), silver: option("Silver"), gold: option("Gold") },
    material: { cotton: option("Cotton"), denim: option("Denim"), leather: option("Leather"), metal: option("Metal"), polyester: option("Polyester") },
    style: { streetwear: option("Streetwear"), vintage: option("Vintage"), y2k: option("Y2K"), minimal: option("Minimal") },
    gender: {
      men: option("Men", "Men", true),
      women: option("Women", "Women", true),
      unisex: option("Unisex", "Unisex"),
      kids: option("Kids", "Kids"),
      unknown: option("Unspecified", "Unspecified"),
    } satisfies Record<UniversalGender, MarketplaceOption>,
    shippingService: { usps_ground: option("USPS Ground Advantage"), priority_mail: option("USPS Priority Mail"), marketplace_label: option("Marketplace prepaid label") },
    packageType: { poly_mailer: option("Poly mailer"), box: option("Box"), padded_mailer: option("Padded mailer") },
    returnPolicy: { no_returns: option("No returns"), thirty_days: option("30-day returns"), marketplace_default: option("Marketplace default") },
    ...extras,
  };
}

export const baseFieldDefinitions: MarketplaceFieldDefinition[] = [
  { key: "title", label: "Title", dataType: "text", importance: "required", required: true, minLength: 1, maxLength: 80, supportsDefault: false, supportsOverride: true, sourcePreference: ["product.title", "variant.title"], validationMessages: { required: "Title is required.", maxLength: "Title is too long." } },
  { key: "description", label: "Description", dataType: "text", importance: "required", required: true, minLength: 20, maxLength: 5000, supportsDefault: true, supportsOverride: true, sourcePreference: ["product.description", "product.title"], validationMessages: { required: "Description is required.", minLength: "Description should include condition and shipping detail." } },
  { key: "price", label: "Price", dataType: "currency", importance: "required", required: true, minimum: 1, supportsDefault: false, supportsOverride: true, sourcePreference: ["override.basePrice", "variant.defaultSalePrice"], validationMessages: { required: "Price is required.", minimum: "Price is too low." } },
  { key: "category", label: "Category", dataType: "single_select", importance: "required", required: true, supportsDefault: false, supportsOverride: true, sourcePreference: ["product.category", "universal.categoryId"], validationMessages: { required: "Category is required.", missingMapping: "Marketplace category mapping is missing." } },
  { key: "condition", label: "Condition", dataType: "single_select", importance: "required", required: true, supportsDefault: true, supportsOverride: true, sourcePreference: ["variant.condition", "account.defaultCondition"], validationMessages: { required: "Condition is required.", acceptedValues: "Condition is not accepted by this marketplace." } },
  { key: "sku", label: "Seller SKU", dataType: "text", importance: "required", required: true, supportsDefault: false, supportsOverride: true, sourcePreference: ["variant.sku", "physicalSku"], validationMessages: { required: "Physical SKU mapping is required." } },
  { key: "brand", label: "Brand", dataType: "text", importance: "recommended", required: false, supportsDefault: true, supportsOverride: true, sourcePreference: ["product.brand", "account.defaultBrand"], validationMessages: {} },
  { key: "size", label: "Size", dataType: "single_select", importance: "conditionally_required", required: false, requiredWhen: [{ categoryGroup: ["clothing", "shoes"] }], supportsDefault: false, supportsOverride: true, sourcePreference: ["variant.title", "attributes.size"], validationMessages: { requiredWhen: "Size is required for clothing and shoes." } },
  { key: "color", label: "Color", dataType: "multi_select", importance: "recommended", required: false, supportsDefault: false, supportsOverride: true, sourcePreference: ["attributes.colors", "product.title"], validationMessages: {} },
  { key: "material", label: "Material", dataType: "multi_select", importance: "recommended", required: false, supportsDefault: false, supportsOverride: true, sourcePreference: ["attributes.materials", "product.description"], validationMessages: {} },
  { key: "images", label: "Images", dataType: "image", importance: "required", required: true, minimum: 1, supportsDefault: false, supportsOverride: true, sourcePreference: ["productImages", "product.images", "product.image"], validationMessages: { required: "At least one image is required." } },
  { key: "weight", label: "Weight", dataType: "weight", importance: "conditionally_required", required: false, requiredWhen: [{ fieldPresent: "shippingProfileId" }], supportsDefault: false, supportsOverride: true, sourcePreference: ["variant.weightOz", "fulfillment.weight"], validationMessages: { requiredWhen: "Weight is required for this shipping method." } },
];

export function category(universalCategoryId: UniversalCategoryId, categoryGroup: string, marketplaceCategoryId: string | null, categoryPath: string[], state: MarketplaceCategoryMapping["state"], confidence: number): MarketplaceCategoryMapping {
  return { universalCategoryId, categoryGroup, marketplaceCategoryId, categoryPath, state, confidence };
}
