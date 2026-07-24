import { unsupportedCapabilities } from "./capabilities";
import { listMarketplaceProfiles } from "./registry";
import type { DataContext, MarketplaceAuditResult } from "./types";

export function marketplaceIntelligenceAudit(data?: DataContext): MarketplaceAuditResult {
  void data;
  return {
    profiles: listMarketplaceProfiles().map((profile) => {
      const implementedCapabilities = Object.entries(profile.syncRules).filter(([, enabled]) => enabled).map(([key]) => key);
      if (profile.capabilities.publishing !== "manual") implementedCapabilities.push(`${profile.capabilities.publishing}_publishing`);
      return {
        marketplace: profile.displayName,
        version: profile.profileVersion,
        fields: profile.fieldDefinitions,
        categoryMappings: profile.categories,
        enumGroups: ["condition", "size", "color", "material", "style", "gender", "shippingService", "packageType", "returnPolicy"],
        ruleConfidence: profile.ruleConfidence,
        implementedCapabilities,
        unsupportedCapabilities: unsupportedCapabilities(profile.marketplace),
        persistence: "static_typescript",
        historicalVersionsPersisted: false,
        administratorEditable: false,
        editsValidatedBeforeActivation: true,
      };
    }),
    hardcodedLogicSearchRequired: true,
  };
}

export function marketplaceRegistrySummary(data?: DataContext) {
  return listMarketplaceProfiles().map((profile) => ({
    marketplace: profile.displayName,
    version: profile.profileVersion,
    status: profile.status,
    publishMode: profile.capabilities.publishing,
    requiredFields: profile.requirements.required.length,
    categoryMappings: profile.categories.length,
    syncFields: Object.entries(profile.syncRules).filter(([, enabled]) => enabled).length,
    openReviews: data?.listingReviewItems?.filter((item) => item.marketplace === profile.displayName && item.status === "open").length || 0,
  }));
}

export const marketplaceArchitectureDiagram = `
UniversalListingInput
  -> Marketplace Registry
  -> Versioned Marketplace Profile
  -> Field Mapper with provenance
  -> Draft Validator
  -> Marketplace Readiness
  -> Connector Payload Preview
  -> Adapter / Extension / Manual workflow
`;
