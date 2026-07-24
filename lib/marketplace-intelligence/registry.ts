import { depopProfile } from "./profiles/depop";
import { ebayProfile } from "./profiles/ebay";
import { etsyProfile } from "./profiles/etsy";
import { mercariProfile } from "./profiles/mercari";
import { poshmarkProfile } from "./profiles/poshmark";
import { marketplaceSlugs, type ManagedMarketplace, type MarketplaceIntelligenceProfile, type MarketplaceSlug } from "./types";

export const marketplaceProfiles: Record<MarketplaceSlug, MarketplaceIntelligenceProfile> = {
  depop: depopProfile,
  ebay: ebayProfile,
  etsy: etsyProfile,
  mercari: mercariProfile,
  poshmark: poshmarkProfile,
};

export function marketplaceSlugFor(marketplace: ManagedMarketplace): MarketplaceSlug {
  return marketplace === "eBay" ? "ebay" : marketplace.toLowerCase() as MarketplaceSlug;
}

export function marketplaceForSlug(slug: MarketplaceSlug): ManagedMarketplace {
  return marketplaceProfiles[slug].displayName;
}

export function listMarketplaceProfiles() {
  return marketplaceSlugs.map((slug) => marketplaceProfiles[slug]);
}

export function getMarketplaceProfile(marketplace: ManagedMarketplace | MarketplaceSlug) {
  const slug = marketplaceSlugs.includes(marketplace as MarketplaceSlug) ? marketplace as MarketplaceSlug : marketplaceSlugFor(marketplace as ManagedMarketplace);
  return marketplaceProfiles[slug];
}

export function validateProfileForActivation(profile: MarketplaceIntelligenceProfile) {
  const errors: string[] = [];
  if (profile.status !== "draft" && profile.status !== "active") errors.push("Only draft or active profiles can be validated for activation.");
  if (!profile.profileVersion.match(/^\d+\.\d+\.\d+$/)) errors.push("Profile version must be semantic.");
  if (!profile.fieldDefinitions.length) errors.push("Profile must define marketplace fields.");
  for (const required of profile.requirements.required) {
    if (!profile.fieldDefinitions.some((field) => field.key === required)) errors.push(`Required field ${required} is missing a field definition.`);
  }
  if (!profile.categories.length) errors.push("Profile must define category mappings.");
  if (!profile.imageRules.maxImages || profile.imageRules.maxImages < profile.imageRules.minImages) errors.push("Image limits are invalid.");
  return errors;
}
