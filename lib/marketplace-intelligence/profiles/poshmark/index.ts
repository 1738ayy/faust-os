import { enumMap } from "../../mappings";
import { commonCategories, commonProfile, field } from "../shared";

export const poshmarkProfile = commonProfile({
  marketplace: "poshmark",
  displayName: "Poshmark",
  profileVersion: "1.9.0",
  capabilities: { authentication: "extension_session", credentialState: "not_connected", publishing: "extension", dryRun: true, humanFinalSubmit: true, inventorySync: true, priceSync: true, titleSync: true, photoSync: true, descriptionSync: true, categorySync: false, orderStatusSync: false },
  fields: [field("title", { maxLength: 80 }), field("description"), field("price", { minimum: 3 }), field("category"), field("condition"), field("sku"), field("brand"), field("size"), field("color"), field("material"), field("images"), field("weight", { importance: "recommended", requiredWhen: undefined })],
  categories: commonCategories.poshmark,
  enums: enumMap({ new_with_tags: { value: "nwt", label: "NWT", verified: true }, excellent: { value: "excellent", label: "Excellent", verified: true }, good: { value: "good", label: "Good", verified: true }, fair: { value: "fair", label: "Fair", verified: true }, like_new: { value: "excellent", label: "Excellent", verified: true } }),
  imageRules: { minImages: 1, maxImages: 16, minWidth: 1200, preferredAspectRatio: "1:1", acceptedTypes: ["image/jpeg", "image/png", "image/webp"], backgroundRecommendation: "Square cover with clean crop.", watermarkPolicy: "discouraged" },
  shippingRules: { defaultService: "marketplace_label", supportedCarriers: ["USPS"], requiresWeight: false, supportsInternational: false, trackingRequired: true },
  pricingRules: { defaultAdjustmentPercent: 12, marketplaceFeePercent: 20, paymentFeePercent: 0, supportsOffers: true, supportsPromotions: true, shippingCostHandling: "buyer_paid" },
  contentRules: { titleMaxLength: 80, descriptionMaxLength: 5000, descriptionMinLength: 20, preferredTitleLength: 72, keywordDensity: "medium", capitalization: "title", hashtags: "ignored", emoji: "supported" },
  syncRules: { inventory: true, price: true, title: true, photos: true, description: true, category: false, orderStatus: false },
  riskRules: { blocks: ["active risk lock"], warnings: ["mass publishing", "image duplication", "suspicious account activity"], recommendations: ["price with offer and bundle room"] },
  operationalLimits: { dailyPublishLimit: 80, maxDraftCount: 400, imageUploadConcurrency: 2, retryWindowMinutes: 60, timeoutSeconds: 45 },
});
