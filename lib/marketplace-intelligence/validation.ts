import type { DraftCompatible, MarketplaceIntelligenceProfile, UniversalListingInput } from "./types";

export function validateUniversalInput(input: UniversalListingInput) {
  const errors: string[] = [];
  if (!input.productId) errors.push("Product ID is required.");
  if (!input.variantIds.length) errors.push("At least one variant is required.");
  if (!input.commerce.sku) errors.push("SKU is required.");
  return errors;
}

export function validateDraftAgainstProfile(profile: MarketplaceIntelligenceProfile, draft: DraftCompatible) {
  const errors: string[] = [];
  if (!draft.title.trim()) errors.push("Title is required.");
  if (draft.title.length > profile.contentRules.titleMaxLength) errors.push(`${profile.displayName} title must be ${profile.contentRules.titleMaxLength} characters or fewer.`);
  if (draft.description.length > profile.contentRules.descriptionMaxLength) errors.push(`${profile.displayName} description must be ${profile.contentRules.descriptionMaxLength} characters or fewer.`);
  if (draft.description.trim().length < profile.contentRules.descriptionMinLength) errors.push("Description must include condition and shipping detail.");
  const priceField = profile.fieldDefinitions.find((field) => field.key === "price");
  if (draft.price < (priceField?.minimum || 0)) errors.push(`Price must be at least $${priceField?.minimum || 0}.`);
  if (!draft.category) errors.push("Category is required.");
  if (draft.imageUrls.length < profile.imageRules.minImages) errors.push(`At least ${profile.imageRules.minImages} image is required.`);
  if (draft.imageUrls.length > profile.imageRules.maxImages) errors.push(`${profile.displayName} accepts at most ${profile.imageRules.maxImages} images.`);
  if (!draft.physicalSku) errors.push("Physical SKU mapping is required.");
  if (!draft.attributes.condition) errors.push("Condition is required.");
  return errors;
}
