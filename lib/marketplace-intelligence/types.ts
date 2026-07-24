import type { ChannelListingDraft, Marketplace, OperatingData, Product, ProductImageRecord, Variant } from "@/domain/business";

export const marketplaceSlugs = ["depop", "ebay", "etsy", "mercari", "poshmark"] as const;
export type MarketplaceSlug = typeof marketplaceSlugs[number];
export type ManagedMarketplace = Exclude<Marketplace, "Manual">;
export type ProfileStatus = "draft" | "active" | "deprecated";
export type PublishCapability = "adapter" | "extension" | "manual";
export type FieldImportance = "required" | "conditionally_required" | "recommended" | "optional" | "unsupported";
export type MarketplaceDataType = "text" | "number" | "currency" | "boolean" | "single_select" | "multi_select" | "image" | "dimensions" | "weight";
export type UniversalCondition = "new_with_tags" | "excellent" | "good" | "fair" | "like_new" | "unknown";
export type UniversalGender = "men" | "women" | "unisex" | "kids" | "unknown";

export type MarketplaceCondition =
  | { categoryGroup: string[] }
  | { fieldPresent: string }
  | { marketplaceAccountDefault: string };

export type MarketplaceOption = { value: string; label: string; verified: boolean };

export type MarketplaceFieldDefinition = {
  key: string;
  label: string;
  dataType: MarketplaceDataType;
  importance: FieldImportance;
  required: boolean;
  requiredWhen?: MarketplaceCondition[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  acceptedValues?: MarketplaceOption[];
  supportsDefault: boolean;
  supportsOverride: boolean;
  sourcePreference: string[];
  validationMessages: Record<string, string>;
};

export type CategoryMappingState = "verified" | "inferred" | "missing" | "deprecated";
export type MarketplaceCategoryMapping = {
  universalCategoryId: string;
  categoryGroup: string;
  marketplaceCategoryId: string | null;
  categoryPath: string[];
  state: CategoryMappingState;
  confidence: number;
  notes?: string;
};

export type MarketplaceCapabilities = {
  authentication: "oauth" | "extension_session" | "manual_session";
  credentialState: "not_connected" | "sandbox_ready" | "live_ready";
  publishing: PublishCapability;
  dryRun: boolean;
  humanFinalSubmit: boolean;
  inventorySync: boolean;
  priceSync: boolean;
  titleSync: boolean;
  photoSync: boolean;
  descriptionSync: boolean;
  categorySync: boolean;
  orderStatusSync: boolean;
};

export type MarketplaceRequirements = {
  required: string[];
  conditionallyRequired: { field: string; requiredWhen: MarketplaceCondition[] }[];
  recommended: string[];
  optional: string[];
  unsupported: string[];
};

export type MarketplaceMappings = {
  fields: Record<string, string>;
  provenanceLabels: Record<string, string>;
};

export type MarketplaceEnumMap = {
  condition: Record<UniversalCondition, MarketplaceOption>;
  size: Record<string, MarketplaceOption>;
  color: Record<string, MarketplaceOption>;
  material: Record<string, MarketplaceOption>;
  style: Record<string, MarketplaceOption>;
  gender: Record<UniversalGender, MarketplaceOption>;
  shippingService: Record<string, MarketplaceOption>;
  packageType: Record<string, MarketplaceOption>;
  returnPolicy: Record<string, MarketplaceOption>;
};

export type MarketplaceImageRules = {
  minImages: number;
  maxImages: number;
  minWidth: number;
  preferredAspectRatio: "1:1" | "4:5" | "free";
  acceptedTypes: string[];
  backgroundRecommendation: string;
  watermarkPolicy: "allowed" | "discouraged" | "blocked";
};

export type MarketplaceShippingRules = {
  defaultService: string;
  supportedCarriers: string[];
  requiresWeight: boolean;
  supportsInternational: boolean;
  trackingRequired: boolean;
};

export type MarketplacePricingRules = {
  defaultAdjustmentPercent: number;
  marketplaceFeePercent: number;
  paymentFeePercent: number;
  supportsOffers: boolean;
  supportsPromotions: boolean;
  shippingCostHandling: "seller_paid" | "buyer_paid" | "mixed";
};

export type MarketplaceContentRules = {
  titleMaxLength: number;
  descriptionMaxLength: number;
  descriptionMinLength: number;
  preferredTitleLength: number;
  keywordDensity: "low" | "medium" | "high";
  capitalization: "sentence" | "title" | "free";
  hashtags: "supported" | "ignored" | "discouraged";
  emoji: "supported" | "discouraged" | "blocked";
};

export type MarketplaceRiskRules = {
  blocks: string[];
  warnings: string[];
  recommendations: string[];
};

export type MarketplaceSyncRules = {
  inventory: boolean;
  price: boolean;
  title: boolean;
  photos: boolean;
  description: boolean;
  category: boolean;
  orderStatus: boolean;
};

export type MarketplaceOperationalLimits = {
  apiRequestsPerMinute?: number;
  dailyPublishLimit?: number;
  maxDraftCount?: number;
  imageUploadConcurrency: number;
  retryWindowMinutes: number;
  timeoutSeconds: number;
};

export type MarketplaceAccountDefaults = {
  shippingService: string;
  handlingTimeDays: number;
  returnPolicy: string;
  defaultCondition: UniversalCondition;
  defaultLocation: string;
  priceAdjustmentPercent: number;
  descriptionFooter: string;
  tags: string[];
  autoOfferEnabled: boolean;
  bundleDiscountPercent: number;
};

export type MarketplaceIntelligenceProfile = {
  marketplace: MarketplaceSlug;
  displayName: ManagedMarketplace;
  profileVersion: string;
  effectiveAt: string;
  status: ProfileStatus;
  ruleConfidence: "verified" | "assumed" | "mixed";
  capabilityNotes: string[];
  capabilities: MarketplaceCapabilities;
  requirements: MarketplaceRequirements;
  fieldDefinitions: MarketplaceFieldDefinition[];
  mappings: MarketplaceMappings;
  categories: MarketplaceCategoryMapping[];
  enums: MarketplaceEnumMap;
  imageRules: MarketplaceImageRules;
  shippingRules: MarketplaceShippingRules;
  pricingRules: MarketplacePricingRules;
  contentRules: MarketplaceContentRules;
  riskRules: MarketplaceRiskRules;
  syncRules: MarketplaceSyncRules;
  operationalLimits: MarketplaceOperationalLimits;
  accountDefaults: MarketplaceAccountDefaults;
};

export type UniversalListingInput = {
  productId: string;
  variantIds: string[];
  identity: {
    title: string | null;
    description: string | null;
    brand: string | null;
    categoryId: string | null;
    categoryLabel: string | null;
    condition: UniversalCondition | null;
  };
  attributes: {
    colors: string[];
    materials: string[];
    styles: string[];
    patterns: string[];
    occasion: string[];
    gender: UniversalGender | null;
    size: string | null;
    measurements: Record<string, number | string>;
  };
  commerce: {
    sku: string | null;
    quantity: number;
    basePrice: number | null;
    cost: number | null;
  };
  fulfillment: {
    weight: number | null;
    dimensions: { length: number | null; width: number | null; height: number | null; unit: "in" | "cm" };
    shippingProfileId: string | null;
  };
  media: {
    imageIds: string[];
    imageUrls: string[];
    coverImageId: string | null;
    videoIds: string[];
  };
  overrides?: Record<string, unknown>;
};

export type GeneratedMarketplaceField = {
  fieldKey: string;
  value: unknown;
  source: "product" | "variant" | "marketplace_default" | "user_override" | "ai_suggestion" | "derived";
  sourcePath: string | null;
  confidence: number | null;
  warnings: string[];
};

export type ReadinessIssue = {
  fieldKey: string;
  severity: "blocker" | "warning" | "recommendation";
  message: string;
  action?: string;
};

export type MarketplaceReadinessResult = {
  marketplace: MarketplaceSlug;
  score: number;
  state: "blocked" | "needs_information" | "needs_review" | "ready";
  blockingIssues: ReadinessIssue[];
  warnings: ReadinessIssue[];
  recommendations: ReadinessIssue[];
};

export type MarketplaceDraftPlan = {
  marketplace: ManagedMarketplace;
  marketplaceSlug: MarketplaceSlug;
  profileVersion: string;
  title: string;
  description: string;
  price: number;
  category: string;
  categoryId: string | null;
  attributes: Record<string, string>;
  imageUrls: string[];
  publishMode: PublishCapability;
  syncCapabilities: MarketplaceSyncRules;
  warnings: string[];
  validationErrors: string[];
  generatedFields: GeneratedMarketplaceField[];
  readiness: MarketplaceReadinessResult;
};

export type MarketplaceDraftInput = {
  product: Product;
  variant: Variant;
  physicalSku: string;
  quantity: number;
  basePrice?: number;
  imageUrls?: string[];
  productImages?: ProductImageRecord[];
  overrides?: Record<string, unknown>;
};

export type MarketplaceKnowledgeGraph = {
  universalSchemaVersion: string;
  nodes: { id: string; label: string; kind: "product_field" | "marketplace_field" | "category" | "condition" | "capability" }[];
  edges: { from: string; to: string; marketplace: ManagedMarketplace; relationship: "maps_to" | "validates_as" | "optimizes" | "ignored_by" | "syncs" }[];
};

export type MarketplaceDraftInspector = {
  universalInput: UniversalListingInput;
  profileVersion: string;
  generatedOutput: MarketplaceDraftPlan;
  mappingSources: GeneratedMarketplaceField[];
  defaultsApplied: GeneratedMarketplaceField[];
  overridesApplied: GeneratedMarketplaceField[];
  validationResults: string[];
  readinessResult: MarketplaceReadinessResult;
  connectorPayloadPreview: Record<string, unknown>;
  riskWarnings: ReadinessIssue[];
};

export type ProfileChange = { field: string; before: unknown; after: unknown; severity: "info" | "warning" };

export type MarketplaceAuditResult = {
  profiles: {
    marketplace: ManagedMarketplace;
    version: string;
    fields: MarketplaceFieldDefinition[];
    categoryMappings: MarketplaceCategoryMapping[];
    enumGroups: (keyof MarketplaceEnumMap)[];
    ruleConfidence: MarketplaceIntelligenceProfile["ruleConfidence"];
    implementedCapabilities: string[];
    unsupportedCapabilities: string[];
    persistence: "static_typescript" | "database" | "configuration_file";
    historicalVersionsPersisted: boolean;
    administratorEditable: boolean;
    editsValidatedBeforeActivation: boolean;
  }[];
  hardcodedLogicSearchRequired: boolean;
};

export type DraftCompatible = Pick<ChannelListingDraft, "marketplace" | "title" | "description" | "price" | "category" | "imageUrls" | "physicalSku" | "attributes">;
export type DataContext = OperatingData | undefined;
