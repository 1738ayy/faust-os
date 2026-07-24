import { enumMap } from "../../mappings";
import { commonCategories, commonProfile, field } from "../shared";

export const mercariProfile = commonProfile({
  marketplace: "mercari",
  displayName: "Mercari",
  profileVersion: "1.8.0",
  capabilities: { authentication: "extension_session", credentialState: "not_connected", publishing: "extension", dryRun: true, humanFinalSubmit: true, inventorySync: true, priceSync: true, titleSync: true, photoSync: true, descriptionSync: true, categorySync: false, orderStatusSync: false },
  fields: [field("title", { maxLength: 80 }), field("description"), field("price"), field("category"), field("condition"), field("sku"), field("brand"), field("size"), field("color"), field("material"), field("images"), field("weight")],
  categories: commonCategories.mercari,
  enums: enumMap({ new_with_tags: { value: "new", label: "New", verified: true }, excellent: { value: "like_new", label: "Like New", verified: true }, good: { value: "good", label: "Good", verified: true }, fair: { value: "fair", label: "Fair", verified: true }, like_new: { value: "like_new", label: "Like New", verified: true } }),
  imageRules: { minImages: 1, maxImages: 12, minWidth: 1200, preferredAspectRatio: "1:1", acceptedTypes: ["image/jpeg", "image/png", "image/webp"], backgroundRecommendation: "Square product-first image set.", watermarkPolicy: "discouraged" },
  shippingRules: { defaultService: "marketplace_label", supportedCarriers: ["USPS", "UPS", "FedEx"], requiresWeight: true, supportsInternational: false, trackingRequired: true },
  pricingRules: { defaultAdjustmentPercent: 0, marketplaceFeePercent: 10, paymentFeePercent: 2.9, supportsOffers: true, supportsPromotions: true, shippingCostHandling: "mixed" },
  contentRules: { titleMaxLength: 80, descriptionMaxLength: 5000, descriptionMinLength: 20, preferredTitleLength: 70, keywordDensity: "medium", capitalization: "sentence", hashtags: "ignored", emoji: "discouraged" },
  syncRules: { inventory: true, price: true, title: true, photos: true, description: true, category: false, orderStatus: false },
  riskRules: { blocks: ["active risk lock"], warnings: ["rapid relisting", "duplicate image set"], recommendations: ["leave offer buffer"] },
  operationalLimits: { dailyPublishLimit: 100, maxDraftCount: 500, imageUploadConcurrency: 2, retryWindowMinutes: 45, timeoutSeconds: 45 },
});
