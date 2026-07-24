import type { MarketplaceIntelligenceProfile, MarketplaceReadinessResult, ReadinessIssue, UniversalListingInput } from "./types";

function conditionMatches(condition: NonNullable<MarketplaceIntelligenceProfile["fieldDefinitions"][number]["requiredWhen"]>[number], input: UniversalListingInput) {
  if ("categoryGroup" in condition) {
    const category = input.identity.categoryId || "";
    return condition.categoryGroup.some((group) => category.includes(group) || (group === "clothing" && category.startsWith("apparel.")) || (group === "shoes" && category.includes("shoes")));
  }
  if ("fieldPresent" in condition) return Boolean(condition.fieldPresent.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, input));
  return false;
}

export function evaluateReadiness(profile: MarketplaceIntelligenceProfile, input: UniversalListingInput, validationErrors: string[], warnings: string[] = []): MarketplaceReadinessResult {
  const blockingIssues: ReadinessIssue[] = [];
  const readinessWarnings: ReadinessIssue[] = warnings.map((message) => ({ fieldKey: "images", severity: "warning", message }));
  const recommendations: ReadinessIssue[] = [];
  const valueFor = (key: string) => {
    if (key === "title") return input.identity.title;
    if (key === "description") return input.identity.description;
    if (key === "category") return input.identity.categoryId;
    if (key === "condition") return input.identity.condition;
    if (key === "price") return input.commerce.basePrice;
    if (key === "sku") return input.commerce.sku;
    if (key === "images") return input.media.imageUrls.length || input.media.imageIds.length;
    if (key === "brand") return input.identity.brand;
    if (key === "size") return input.attributes.size;
    if (key === "weight") return input.fulfillment.weight;
    return input.overrides?.[key];
  };
  for (const field of profile.fieldDefinitions) {
    const value = valueFor(field.key);
    const missing = value === null || value === undefined || value === "" || value === 0;
    if (field.required && missing) blockingIssues.push({ fieldKey: field.key, severity: "blocker", message: field.validationMessages.required || `${field.label} is required.`, action: `Add ${field.label.toLowerCase()}` });
    if (!field.required && field.requiredWhen?.some((condition) => conditionMatches(condition, input)) && missing) {
      blockingIssues.push({ fieldKey: field.key, severity: "blocker", message: field.validationMessages.requiredWhen || `${field.label} is required for this listing.`, action: `Add ${field.label.toLowerCase()}` });
    }
    if (field.importance === "recommended" && missing) recommendations.push({ fieldKey: field.key, severity: "recommendation", message: `${field.label} improves marketplace readiness.`, action: `Add ${field.label.toLowerCase()}` });
  }
  for (const error of validationErrors) blockingIssues.push({ fieldKey: "validation", severity: "blocker", message: error });
  if (input.media.imageUrls.length < Math.max(3, profile.imageRules.minImages)) readinessWarnings.push({ fieldKey: "images", severity: "warning", message: `Only ${input.media.imageUrls.length} image(s) are available.` });
  const score = Math.max(0, Math.min(100, 100 - blockingIssues.length * 22 - readinessWarnings.length * 7 - recommendations.length * 3));
  const state = blockingIssues.length ? "blocked" : score < 75 ? "needs_information" : readinessWarnings.length ? "needs_review" : "ready";
  return { marketplace: profile.marketplace, score, state, blockingIssues, warnings: readinessWarnings, recommendations };
}
