import { enumMap } from "../../mappings";
import { commonCategories, commonProfile, field } from "../shared";

export const depopProfile = commonProfile({
  marketplace: "depop",
  displayName: "Depop",
  profileVersion: "2.4.0",
  capabilities: { authentication: "oauth", credentialState: "sandbox_ready", publishing: "adapter", dryRun: true, humanFinalSubmit: false, inventorySync: true, priceSync: true, titleSync: true, photoSync: true, descriptionSync: true, categorySync: false, orderStatusSync: true },
  fields: [field("title", { maxLength: 80 }), field("description"), field("price"), field("category"), field("condition"), field("sku"), field("brand"), field("size"), field("color"), field("material"), field("images"), field("weight")],
  categories: commonCategories.depop,
  enums: enumMap({ new_with_tags: { value: "brand_new", label: "Brand new", verified: true }, excellent: { value: "used_excellent", label: "Used - Excellent", verified: true }, good: { value: "used_good", label: "Used - Good", verified: true }, fair: { value: "used_fair", label: "Used - Fair", verified: true }, like_new: { value: "used_excellent", label: "Used - Excellent", verified: true } }),
  imageRules: { minImages: 1, maxImages: 8, minWidth: 1200, preferredAspectRatio: "1:1", acceptedTypes: ["image/jpeg", "image/png", "image/webp"], backgroundRecommendation: "Clean background with natural light.", watermarkPolicy: "discouraged" },
  shippingRules: { defaultService: "usps_ground", supportedCarriers: ["USPS"], requiresWeight: true, supportsInternational: true, trackingRequired: true },
  pricingRules: { defaultAdjustmentPercent: 0, marketplaceFeePercent: 10, paymentFeePercent: 2.9, supportsOffers: true, supportsPromotions: true, shippingCostHandling: "seller_paid" },
  contentRules: { titleMaxLength: 80, descriptionMaxLength: 5000, descriptionMinLength: 20, preferredTitleLength: 72, keywordDensity: "medium", capitalization: "sentence", hashtags: "supported", emoji: "discouraged" },
  syncRules: { inventory: true, price: true, title: true, photos: true, description: true, category: false, orderStatus: true },
  riskRules: { blocks: ["active risk lock"], warnings: ["potential duplicate listing", "rapid price changes", "image duplication"], recommendations: ["use natural trend terms", "avoid repeated mass publish attempts"] },
  operationalLimits: { apiRequestsPerMinute: 80, dailyPublishLimit: 120, maxDraftCount: 500, imageUploadConcurrency: 3, retryWindowMinutes: 30, timeoutSeconds: 45 },
});
