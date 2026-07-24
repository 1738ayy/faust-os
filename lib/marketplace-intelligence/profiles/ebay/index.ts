import { enumMap } from "../../mappings";
import { commonCategories, commonProfile, field } from "../shared";

export const ebayProfile = commonProfile({
  marketplace: "ebay",
  displayName: "eBay",
  profileVersion: "4.1.0",
  capabilities: { authentication: "oauth", credentialState: "sandbox_ready", publishing: "adapter", dryRun: true, humanFinalSubmit: false, inventorySync: true, priceSync: true, titleSync: true, photoSync: true, descriptionSync: true, categorySync: true, orderStatusSync: true },
  fields: [field("title", { maxLength: 80 }), field("description", { maxLength: 500000 }), field("price", { minimum: 0.99 }), field("category"), field("condition"), field("sku"), field("brand"), field("size"), field("color"), field("material"), field("images"), field("weight")],
  categories: commonCategories.ebay,
  enums: enumMap({ new_with_tags: { value: "NEW_WITH_TAGS", label: "New with tags", verified: true }, excellent: { value: "PRE_OWNED_EXCELLENT", label: "Pre-owned", verified: true }, good: { value: "PRE_OWNED_GOOD", label: "Pre-owned", verified: true }, fair: { value: "PRE_OWNED_FAIR", label: "Pre-owned", verified: true }, like_new: { value: "PRE_OWNED_EXCELLENT", label: "Pre-owned", verified: true } }),
  imageRules: { minImages: 1, maxImages: 12, minWidth: 1200, preferredAspectRatio: "free", acceptedTypes: ["image/jpeg", "image/png", "image/webp"], backgroundRecommendation: "Clear product-first photos; white backgrounds perform well.", watermarkPolicy: "blocked" },
  shippingRules: { defaultService: "usps_ground", supportedCarriers: ["USPS", "UPS", "FedEx"], requiresWeight: true, supportsInternational: true, trackingRequired: true },
  pricingRules: { defaultAdjustmentPercent: 8, marketplaceFeePercent: 13.25, paymentFeePercent: 0, supportsOffers: true, supportsPromotions: true, shippingCostHandling: "mixed" },
  contentRules: { titleMaxLength: 80, descriptionMaxLength: 500000, descriptionMinLength: 20, preferredTitleLength: 78, keywordDensity: "high", capitalization: "title", hashtags: "ignored", emoji: "blocked" },
  syncRules: { inventory: true, price: true, title: true, photos: true, description: true, category: true, orderStatus: true },
  riskRules: { blocks: ["active risk lock", "restricted category"], warnings: ["duplicate SKU", "repeated failed uploads"], recommendations: ["include searchable nouns", "avoid unsupported symbols"] },
  operationalLimits: { apiRequestsPerMinute: 100, dailyPublishLimit: 250, maxDraftCount: 1000, imageUploadConcurrency: 4, retryWindowMinutes: 45, timeoutSeconds: 60 },
});
