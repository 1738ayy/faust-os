import type { MarketplaceCategoryMapping, MarketplaceDraftInput, MarketplaceDraftInspector, MarketplaceDraftPlan, MarketplaceKnowledgeGraph, ManagedMarketplace, MarketplaceSlug, UniversalCondition, UniversalListingInput } from "./types";
import { inferUniversalCategoryId, universalCategoryLabels } from "./mappings";
import { getMarketplaceProfile, listMarketplaceProfiles, marketplaceForSlug } from "./registry";
import { evaluateReadiness } from "./readiness";
import { validateDraftAgainstProfile } from "./validation";

export function normalizeUniversalCondition(value?: string | null): UniversalCondition {
  const condition = (value || "").toLowerCase();
  if (condition.includes("new")) return "new_with_tags";
  if (condition.includes("excellent")) return "excellent";
  if (condition.includes("like")) return "like_new";
  if (condition.includes("good")) return "good";
  if (condition.includes("fair")) return "fair";
  return "unknown";
}

export function buildUniversalListingInput(input: MarketplaceDraftInput): UniversalListingInput {
  const images = input.productImages?.length
    ? input.productImages.sort((a, b) => a.position - b.position).map((image) => image.url)
    : input.imageUrls?.length ? input.imageUrls : [input.product.image, ...(input.product.images || [])].filter((url): url is string => Boolean(url));
  const categoryId = inferUniversalCategoryId(`${input.product.category} ${input.product.title}`);
  const size = input.variant.title.match(/\b(XS|S|M|L|XL|XXL|One Size)\b/i)?.[0] || null;
  return {
    productId: input.product.id,
    variantIds: [input.variant.id],
    identity: {
      title: input.product.title || input.variant.title || null,
      description: input.product.description || null,
      brand: input.product.brand || null,
      categoryId,
      categoryLabel: categoryId ? universalCategoryLabels[categoryId] : input.product.category || null,
      condition: normalizeUniversalCondition(input.variant.condition),
    },
    attributes: { colors: [], materials: [], styles: input.product.tags || [], patterns: [], occasion: [], gender: "unisex", size, measurements: {} },
    commerce: { sku: input.physicalSku || input.variant.sku || null, quantity: input.quantity, basePrice: input.basePrice ?? input.variant.defaultSalePrice ?? null, cost: input.variant.landedUnitCost ?? null },
    fulfillment: { weight: input.variant.weightOz || null, dimensions: { length: null, width: null, height: null, unit: "in" }, shippingProfileId: null },
    media: { imageIds: input.productImages?.map((image) => image.id) || [], imageUrls: [...new Set(images)], coverImageId: input.product.coverImageId || input.productImages?.find((image) => image.isCover)?.id || null, videoIds: [] },
    overrides: input.overrides,
  };
}

function normalizeTitle(value: string, limit: number) {
  const title = value.replace(/\s+/g, " ").trim();
  if (title.length <= limit) return title;
  return `${title.slice(0, Math.max(limit - 3, 0)).trimEnd()}...`;
}

function categoryFor(marketplace: MarketplaceSlug, universalCategoryId: string | null): MarketplaceCategoryMapping | undefined {
  const profile = getMarketplaceProfile(marketplace);
  return profile.categories.find((entry) => entry.universalCategoryId === universalCategoryId);
}

export function translateCategory(universalCategoryIdOrLabel: string, marketplace: ManagedMarketplace | MarketplaceSlug) {
  const profile = getMarketplaceProfile(marketplace);
  const categoryId = inferUniversalCategoryId(universalCategoryIdOrLabel) || universalCategoryIdOrLabel;
  const mapping = profile.categories.find((entry) => entry.universalCategoryId === categoryId);
  return mapping?.categoryPath.join(" > ") || universalCategoryIdOrLabel;
}

export function translateCondition(universalCondition: string, marketplace: ManagedMarketplace | MarketplaceSlug) {
  const profile = getMarketplaceProfile(marketplace);
  const condition = normalizeUniversalCondition(universalCondition);
  return profile.enums.condition[condition]?.label || profile.enums.condition.unknown.label;
}

export function selectImagesForMarketplace(imageUrls: string[], marketplace: ManagedMarketplace | MarketplaceSlug) {
  const profile = getMarketplaceProfile(marketplace);
  const unique = [...new Set(imageUrls.filter(Boolean))];
  const selected = unique.slice(0, profile.imageRules.maxImages);
  const warnings = unique.length > selected.length
    ? [`${profile.displayName} accepts ${profile.imageRules.maxImages} images, so ${unique.length - selected.length} image(s) were held back.`]
    : [];
  return { selected, warnings };
}

export function generateMarketplaceDraftPlan(marketplace: ManagedMarketplace, input: MarketplaceDraftInput): MarketplaceDraftPlan {
  const profile = getMarketplaceProfile(marketplace);
  const universal = buildUniversalListingInput(input);
  const categoryMapping = categoryFor(profile.marketplace, universal.identity.categoryId);
  const { selected, warnings } = selectImagesForMarketplace(universal.media.imageUrls, profile.marketplace);
  const baseTitle = universal.identity.title || input.variant.title;
  const suffix = ` - ${universal.commerce.sku || input.variant.sku}`;
  const fullTitle = `${baseTitle}${suffix}`;
  const title = fullTitle.length <= profile.contentRules.titleMaxLength
    ? fullTitle
    : suffix.length < profile.contentRules.titleMaxLength - 12
      ? `${normalizeTitle(baseTitle, profile.contentRules.titleMaxLength - suffix.length)}${suffix}`
      : normalizeTitle(fullTitle, profile.contentRules.titleMaxLength);
  const price = Math.round((universal.commerce.basePrice || input.variant.defaultSalePrice) * (1 + profile.pricingRules.defaultAdjustmentPercent / 100) * 100) / 100;
  const condition = profile.enums.condition[universal.identity.condition || "unknown"].label;
  const category = categoryMapping?.categoryPath.join(" > ") || "";
  const description = [
    universal.identity.description || universal.identity.title || input.variant.title,
    "",
    `Condition: ${condition}`,
    category ? `Category: ${category}` : "Category: Needs review",
    `Physical SKU: ${universal.commerce.sku || input.variant.sku}`,
    profile.accountDefaults.descriptionFooter,
  ].join("\n");
  const attributes: Record<string, string> = { condition, brand: universal.identity.brand || "Unbranded", shippingService: profile.accountDefaults.shippingService };
  if (universal.attributes.size) attributes.size = universal.attributes.size;
  const generatedFields = [
    { fieldKey: "title", value: title, source: "derived" as const, sourcePath: "identity.title + commerce.sku", confidence: 0.92, warnings: title.length < fullTitle.length ? ["Title was shortened to fit marketplace limit."] : [] },
    { fieldKey: "description", value: description, source: universal.identity.description ? "product" as const : "derived" as const, sourcePath: universal.identity.description ? "identity.description" : "identity.title", confidence: universal.identity.description ? 0.95 : 0.72, warnings: [] },
    { fieldKey: "price", value: price, source: input.basePrice ? "user_override" as const : "variant" as const, sourcePath: input.basePrice ? "basePrice" : "variant.defaultSalePrice", confidence: 0.9, warnings: [] },
    { fieldKey: "category", value: category, source: "derived" as const, sourcePath: "identity.categoryId", confidence: categoryMapping?.confidence ?? 0, warnings: categoryMapping?.state === "verified" ? [] : [`Category mapping is ${categoryMapping?.state || "missing"}.`] },
    { fieldKey: "condition", value: condition, source: "variant" as const, sourcePath: "variant.condition", confidence: profile.enums.condition[universal.identity.condition || "unknown"].verified ? 0.94 : 0.68, warnings: profile.enums.condition[universal.identity.condition || "unknown"].verified ? [] : ["Condition translation needs review."] },
    { fieldKey: "images", value: selected, source: "product" as const, sourcePath: "media.imageUrls", confidence: selected.length ? 0.9 : 0, warnings },
    { fieldKey: "shippingService", value: profile.accountDefaults.shippingService, source: "marketplace_default" as const, sourcePath: "accountDefaults.shippingService", confidence: 0.82, warnings: [] },
  ];
  const draftLike = { marketplace: profile.displayName, title, description, price, category, attributes, imageUrls: selected, physicalSku: universal.commerce.sku || "" };
  const validationErrors = validateDraftAgainstProfile(profile, draftLike);
  const readiness = evaluateReadiness(profile, universal, validationErrors, warnings);
  return { marketplace, marketplaceSlug: profile.marketplace, profileVersion: profile.profileVersion, title, description, price, category, categoryId: categoryMapping?.marketplaceCategoryId || null, attributes, imageUrls: selected, publishMode: profile.capabilities.publishing, syncCapabilities: profile.syncRules, warnings, validationErrors, generatedFields, readiness };
}

export function validateMarketplaceDraft(draft: Parameters<typeof validateDraftAgainstProfile>[1]) {
  return validateDraftAgainstProfile(getMarketplaceProfile(draft.marketplace), draft);
}

export function buildMarketplaceKnowledgeGraph(): MarketplaceKnowledgeGraph {
  const nodes = new Map<MarketplaceKnowledgeGraph["nodes"][number]["id"], MarketplaceKnowledgeGraph["nodes"][number]>();
  const edges: MarketplaceKnowledgeGraph["edges"] = [];
  const addNode = (node: MarketplaceKnowledgeGraph["nodes"][number]) => nodes.set(node.id, node);
  for (const profile of listMarketplaceProfiles()) {
    addNode({ id: `capability:${profile.marketplace}:publish:${profile.capabilities.publishing}`, label: `${profile.displayName} publishing: ${profile.capabilities.publishing}`, kind: "capability" });
    for (const field of profile.fieldDefinitions) {
      addNode({ id: `universal:${field.key}`, label: field.label, kind: "product_field" });
      addNode({ id: `${profile.marketplace}:field:${profile.mappings.fields[field.key]}`, label: `${profile.displayName} ${profile.mappings.fields[field.key]}`, kind: "marketplace_field" });
      edges.push({ from: `universal:${field.key}`, to: `${profile.marketplace}:field:${profile.mappings.fields[field.key]}`, marketplace: profile.displayName, relationship: field.importance === "unsupported" ? "ignored_by" : "maps_to" });
    }
    for (const mapping of profile.categories) {
      addNode({ id: `category:${mapping.universalCategoryId}`, label: mapping.universalCategoryId, kind: "category" });
      addNode({ id: `${profile.marketplace}:category:${mapping.marketplaceCategoryId || "missing"}`, label: mapping.categoryPath.join(" > ") || "Missing category", kind: "category" });
      edges.push({ from: `category:${mapping.universalCategoryId}`, to: `${profile.marketplace}:category:${mapping.marketplaceCategoryId || "missing"}`, marketplace: profile.displayName, relationship: mapping.state === "missing" ? "ignored_by" : "maps_to" });
    }
    for (const [condition, mapped] of Object.entries(profile.enums.condition)) {
      addNode({ id: `condition:${condition}`, label: condition, kind: "condition" });
      addNode({ id: `${profile.marketplace}:condition:${mapped.value}`, label: mapped.label, kind: "condition" });
      edges.push({ from: `condition:${condition}`, to: `${profile.marketplace}:condition:${mapped.value}`, marketplace: profile.displayName, relationship: "validates_as" });
    }
    for (const [capability, enabled] of Object.entries(profile.syncRules)) {
      addNode({ id: `sync:${capability}`, label: capability, kind: "capability" });
      edges.push({ from: `sync:${capability}`, to: `capability:${profile.marketplace}:publish:${profile.capabilities.publishing}`, marketplace: profile.displayName, relationship: enabled ? "syncs" : "ignored_by" });
    }
  }
  return { universalSchemaVersion: "2026.07.universal-listing-schema", nodes: [...nodes.values()], edges };
}

export function inspectMarketplaceDraft(input: MarketplaceDraftInput, marketplace: ManagedMarketplace): MarketplaceDraftInspector {
  const universalInput = buildUniversalListingInput(input);
  const generatedOutput = generateMarketplaceDraftPlan(marketplace, input);
  const defaultsApplied = generatedOutput.generatedFields.filter((field) => field.source === "marketplace_default");
  const overridesApplied = generatedOutput.generatedFields.filter((field) => field.source === "user_override");
  return {
    universalInput,
    profileVersion: generatedOutput.profileVersion,
    generatedOutput,
    mappingSources: generatedOutput.generatedFields,
    defaultsApplied,
    overridesApplied,
    validationResults: generatedOutput.validationErrors,
    readinessResult: generatedOutput.readiness,
    connectorPayloadPreview: { title: generatedOutput.title, description: generatedOutput.description, price: generatedOutput.price, quantity: universalInput.commerce.quantity, category: generatedOutput.category, imageUrls: generatedOutput.imageUrls, attributes: generatedOutput.attributes },
    riskWarnings: generatedOutput.readiness.warnings,
  };
}

export const MarketplaceEngine = {
  profiles: listMarketplaceProfiles,
  profile: getMarketplaceProfile,
  knowledgeGraph: buildMarketplaceKnowledgeGraph,
  generateDraft(input: MarketplaceDraftInput, marketplace: ManagedMarketplace) {
    return generateMarketplaceDraftPlan(marketplace, input);
  },
  validateDraft: validateMarketplaceDraft,
  inspectDraft: inspectMarketplaceDraft,
  category: translateCategory,
  condition: translateCondition,
  marketplaceForSlug,
};
