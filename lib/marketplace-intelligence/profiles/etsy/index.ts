import { enumMap } from "../../mappings";
import { commonCategories, commonProfile, field } from "../shared";

export const etsyProfile = commonProfile({
  marketplace: "etsy",
  displayName: "Etsy",
  profileVersion: "3.4.0",
  capabilities: { authentication: "extension_session", credentialState: "not_connected", publishing: "extension", dryRun: true, humanFinalSubmit: true, inventorySync: true, priceSync: true, titleSync: true, photoSync: true, descriptionSync: true, categorySync: false, orderStatusSync: true },
  fields: [field("title", { maxLength: 140 }), field("description"), field("price", { minimum: 0.2 }), field("category"), field("condition"), field("sku"), field("brand"), field("size"), field("color"), field("material"), field("images"), field("weight")],
  categories: commonCategories.etsy,
  enums: enumMap({ new_with_tags: { value: "finished_product", label: "Finished product", verified: false }, excellent: { value: "vintage", label: "Vintage", verified: false }, good: { value: "vintage", label: "Vintage", verified: false }, fair: { value: "vintage", label: "Vintage", verified: false }, like_new: { value: "vintage", label: "Vintage", verified: false } }),
  imageRules: { minImages: 1, maxImages: 10, minWidth: 2000, preferredAspectRatio: "4:5", acceptedTypes: ["image/jpeg", "image/png", "image/webp"], backgroundRecommendation: "Lifestyle or clean handmade-oriented image set.", watermarkPolicy: "discouraged" },
  shippingRules: { defaultService: "usps_ground", supportedCarriers: ["USPS"], requiresWeight: true, supportsInternational: true, trackingRequired: true },
  pricingRules: { defaultAdjustmentPercent: 4, marketplaceFeePercent: 9.5, paymentFeePercent: 3, supportsOffers: false, supportsPromotions: true, shippingCostHandling: "mixed" },
  contentRules: { titleMaxLength: 140, descriptionMaxLength: 5000, descriptionMinLength: 20, preferredTitleLength: 120, keywordDensity: "high", capitalization: "sentence", hashtags: "ignored", emoji: "discouraged" },
  syncRules: { inventory: true, price: true, title: true, photos: true, description: true, category: false, orderStatus: true },
  riskRules: { blocks: ["active risk lock"], warnings: ["handmade or vintage positioning may need review", "category mismatch"], recommendations: ["state source and material clearly"] },
  operationalLimits: { dailyPublishLimit: 100, maxDraftCount: 500, imageUploadConcurrency: 2, retryWindowMinutes: 60, timeoutSeconds: 60 },
});
