import type { MarketplaceIntelligenceProfile, ProfileChange } from "./types";

export function diffMarketplaceProfiles(previous: MarketplaceIntelligenceProfile, next: MarketplaceIntelligenceProfile): ProfileChange[] {
  const changes: ProfileChange[] = [];
  const compare = (field: string, before: unknown, after: unknown, severity: ProfileChange["severity"] = "info") => {
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ field, before, after, severity });
  };
  compare("profileVersion", previous.profileVersion, next.profileVersion);
  compare("contentRules.titleMaxLength", previous.contentRules.titleMaxLength, next.contentRules.titleMaxLength, "warning");
  compare("imageRules.maxImages", previous.imageRules.maxImages, next.imageRules.maxImages, "warning");
  compare("shippingRules.defaultService", previous.shippingRules.defaultService, next.shippingRules.defaultService, "warning");
  compare("requirements.required", previous.requirements.required, next.requirements.required, "warning");
  compare("syncRules", previous.syncRules, next.syncRules, "warning");
  return changes;
}

export function activateProfileVersion(current: MarketplaceIntelligenceProfile, draft: MarketplaceIntelligenceProfile) {
  return {
    activated: { ...draft, status: "active" as const, effectiveAt: new Date().toISOString() },
    deprecated: { ...current, status: "deprecated" as const },
    changes: diffMarketplaceProfiles(current, draft),
  };
}
