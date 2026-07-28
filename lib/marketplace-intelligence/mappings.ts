import type { MarketplaceCategoryMapping, MarketplaceEnumMap, MarketplaceFieldDefinition, MarketplaceOption, UniversalCondition, UniversalGender } from "./types";

export const universalCategoryIds = [
  "apparel.tops.tshirts",
  "apparel.tops.general",
  "apparel.tops.sweatshirts",
  "apparel.tops.hoodies",
  "apparel.bottoms.jeans",
  "apparel.bottoms.shorts",
  "apparel.shoes.sneakers",
  "jewelry.general",
  "jewelry.necklaces",
  "jewelry.bracelets",
  "accessories.belts",
  "bags.handbags",
  "accessories.general",
  "collectibles.general",
] as const;

export type UniversalCategoryId = typeof universalCategoryIds[number];

export const universalCategoryLabels: Record<UniversalCategoryId, string> = {
  "apparel.tops.tshirts": "T-shirt",
  "apparel.tops.general": "Tops",
  "apparel.tops.sweatshirts": "Sweatshirt",
  "apparel.tops.hoodies": "Hoodie",
  "apparel.bottoms.jeans": "Jeans",
  "apparel.bottoms.shorts": "Shorts",
  "apparel.shoes.sneakers": "Shoes",
  "jewelry.general": "Jewelry",
  "jewelry.necklaces": "Necklace",
  "jewelry.bracelets": "Bracelet",
  "accessories.belts": "Belt",
  "bags.handbags": "Handbag",
  "accessories.general": "Accessories",
  "collectibles.general": "Collectible",
};

export type UniversalCategoryProfile = {
  id: UniversalCategoryId;
  displayName: string;
  parent: string;
  aliases: string[];
  expectedAttributes: string[];
  likelyVariantGroups: string[];
  marketplaceMappingHooks: string[];
  relatedCategories: UniversalCategoryId[];
  disambiguationSignals: string[];
  commonConfusions: UniversalCategoryId[];
};

export const universalCategoryProfiles: Record<UniversalCategoryId, UniversalCategoryProfile> = {
  "apparel.tops.tshirts": { id: "apparel.tops.tshirts", displayName: "T-shirt", parent: "apparel.tops", aliases: ["t-shirt", "tee", "shirt", "short sleeve", "long sleeve tee", "短袖", "T恤"], expectedAttributes: ["material", "color", "size", "sleeve length"], likelyVariantGroups: ["Color", "Size"], marketplaceMappingHooks: ["clothing", "tops", "tshirt"], relatedCategories: ["apparel.tops.general", "apparel.tops.sweatshirts"], disambiguationSignals: ["pullover construction", "knit fabric", "no full front opening", "crew neck or graphic tee wording"], commonConfusions: ["apparel.tops.general", "apparel.tops.sweatshirts"] },
  "apparel.tops.general": { id: "apparel.tops.general", displayName: "Tops", parent: "apparel.tops", aliases: ["top", "blouse", "camisole", "tank", "vest", "上衣"], expectedAttributes: ["material", "color", "size"], likelyVariantGroups: ["Color", "Size"], marketplaceMappingHooks: ["clothing", "tops"], relatedCategories: ["apparel.tops.tshirts", "apparel.tops.sweatshirts"], disambiguationSignals: ["top garment language without tee or sweatshirt evidence"], commonConfusions: ["apparel.tops.tshirts", "apparel.tops.sweatshirts"] },
  "apparel.tops.sweatshirts": { id: "apparel.tops.sweatshirts", displayName: "Sweatshirt", parent: "apparel.tops", aliases: ["sweatshirt", "pullover", "crewneck", "fleece"], expectedAttributes: ["material", "color", "size"], likelyVariantGroups: ["Color", "Size"], marketplaceMappingHooks: ["clothing", "sweatshirt"], relatedCategories: ["apparel.tops.hoodies", "apparel.tops.tshirts"], disambiguationSignals: ["thicker fleece or sweatshirt wording", "no hood"], commonConfusions: ["apparel.tops.hoodies", "apparel.tops.tshirts"] },
  "apparel.tops.hoodies": { id: "apparel.tops.hoodies", displayName: "Hoodie", parent: "apparel.tops", aliases: ["hoodie", "hooded sweatshirt", "sweater with hood", "连帽"], expectedAttributes: ["material", "color", "size"], likelyVariantGroups: ["Color", "Size"], marketplaceMappingHooks: ["clothing", "hoodie"], relatedCategories: ["apparel.tops.sweatshirts"], disambiguationSignals: ["hood visible or hood wording"], commonConfusions: ["apparel.tops.sweatshirts"] },
  "apparel.bottoms.jeans": { id: "apparel.bottoms.jeans", displayName: "Jeans", parent: "apparel.bottoms", aliases: ["jeans", "denim pants", "牛仔裤"], expectedAttributes: ["waist", "inseam", "color", "denim"], likelyVariantGroups: ["Color", "Size"], marketplaceMappingHooks: ["clothing", "bottoms", "jeans"], relatedCategories: ["apparel.bottoms.shorts"], disambiguationSignals: ["long pants construction", "denim wording"], commonConfusions: ["apparel.bottoms.shorts"] },
  "apparel.bottoms.shorts": { id: "apparel.bottoms.shorts", displayName: "Shorts", parent: "apparel.bottoms", aliases: ["shorts", "short pants", "jorts", "短裤"], expectedAttributes: ["waist", "inseam", "color"], likelyVariantGroups: ["Color", "Size"], marketplaceMappingHooks: ["clothing", "bottoms", "shorts"], relatedCategories: ["apparel.bottoms.jeans"], disambiguationSignals: ["short-leg bottom construction"], commonConfusions: ["apparel.bottoms.jeans"] },
  "apparel.shoes.sneakers": { id: "apparel.shoes.sneakers", displayName: "Shoes", parent: "apparel.shoes", aliases: ["shoe", "sneaker", "boots", "鞋"], expectedAttributes: ["size", "color"], likelyVariantGroups: ["Color", "Shoe size"], marketplaceMappingHooks: ["shoes"], relatedCategories: ["accessories.general"], disambiguationSignals: ["pair footwear structure"], commonConfusions: ["accessories.general"] },
  "jewelry.general": { id: "jewelry.general", displayName: "Jewelry", parent: "jewelry", aliases: ["jewelry", "jewellery", "饰品"], expectedAttributes: ["material", "color", "finish"], likelyVariantGroups: ["Color", "Style"], marketplaceMappingHooks: ["jewelry"], relatedCategories: ["jewelry.necklaces", "jewelry.bracelets"], disambiguationSignals: ["ornamental item but subtype unclear"], commonConfusions: ["jewelry.necklaces", "jewelry.bracelets", "accessories.general"] },
  "jewelry.necklaces": { id: "jewelry.necklaces", displayName: "Necklace", parent: "jewelry", aliases: ["necklace", "chain", "pendant", "项链"], expectedAttributes: ["material", "length", "color"], likelyVariantGroups: ["Color", "Style"], marketplaceMappingHooks: ["jewelry", "necklace"], relatedCategories: ["jewelry.general", "jewelry.bracelets"], disambiguationSignals: ["chain or pendant worn around neck"], commonConfusions: ["jewelry.bracelets", "jewelry.general"] },
  "jewelry.bracelets": { id: "jewelry.bracelets", displayName: "Bracelet", parent: "jewelry", aliases: ["bracelet", "bangle", "手链"], expectedAttributes: ["material", "color"], likelyVariantGroups: ["Color", "Style"], marketplaceMappingHooks: ["jewelry", "bracelet"], relatedCategories: ["jewelry.general", "jewelry.necklaces"], disambiguationSignals: ["wrist-worn chain or band"], commonConfusions: ["jewelry.necklaces", "jewelry.general"] },
  "accessories.belts": { id: "accessories.belts", displayName: "Belt", parent: "accessories", aliases: ["belt", "waist belt", "腰带"], expectedAttributes: ["material", "length", "color"], likelyVariantGroups: ["Color", "Length"], marketplaceMappingHooks: ["accessories", "belt"], relatedCategories: ["accessories.general"], disambiguationSignals: ["strap with buckle or waist accessory"], commonConfusions: ["accessories.general", "bags.handbags"] },
  "bags.handbags": { id: "bags.handbags", displayName: "Handbag", parent: "bags", aliases: ["bag", "handbag", "purse", "shoulder bag", "tote", "包"], expectedAttributes: ["material", "color", "dimensions"], likelyVariantGroups: ["Color", "Style"], marketplaceMappingHooks: ["bags"], relatedCategories: ["accessories.general"], disambiguationSignals: ["bag body with handle or strap"], commonConfusions: ["accessories.general"] },
  "accessories.general": { id: "accessories.general", displayName: "Accessories", parent: "accessories", aliases: ["accessory", "accessories", "hair accessory", "配件"], expectedAttributes: ["material", "color"], likelyVariantGroups: ["Color", "Style"], marketplaceMappingHooks: ["accessories"], relatedCategories: ["accessories.belts", "jewelry.general", "bags.handbags"], disambiguationSignals: ["non-apparel wearable item with unclear subtype"], commonConfusions: ["jewelry.general", "bags.handbags", "accessories.belts"] },
  "collectibles.general": { id: "collectibles.general", displayName: "Collectible", parent: "collectibles", aliases: ["collectible", "toy", "figure"], expectedAttributes: ["condition"], likelyVariantGroups: ["Style"], marketplaceMappingHooks: ["collectibles"], relatedCategories: ["accessories.general"], disambiguationSignals: ["collectible object not worn as apparel"], commonConfusions: ["accessories.general"] },
};

export function inferUniversalCategoryId(label?: string | null): UniversalCategoryId | null {
  const value = (label || "").toLowerCase();
  const aliasMatch = Object.values(universalCategoryProfiles).find((profile) => profile.aliases.some((alias) => value.includes(alias.toLowerCase())));
  if (aliasMatch) return aliasMatch.id;
  if (value.includes("streetwear")) return "apparel.tops.tshirts";
  if (value.includes("pants")) return "apparel.bottoms.jeans";
  if (value.includes("shoe") || value.includes("sneaker")) return "apparel.shoes.sneakers";
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
