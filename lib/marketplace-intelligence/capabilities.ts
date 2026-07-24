import { getMarketplaceProfile } from "./registry";
import type { ManagedMarketplace, MarketplaceSlug } from "./types";

export function publishCapability(marketplace: ManagedMarketplace | MarketplaceSlug) {
  return getMarketplaceProfile(marketplace).capabilities.publishing;
}

export function syncCapabilities(marketplace: ManagedMarketplace | MarketplaceSlug) {
  return getMarketplaceProfile(marketplace).syncRules;
}

export function unsupportedCapabilities(marketplace: ManagedMarketplace | MarketplaceSlug) {
  const profile = getMarketplaceProfile(marketplace);
  return Object.entries(profile.syncRules).filter(([, enabled]) => !enabled).map(([key]) => key);
}
