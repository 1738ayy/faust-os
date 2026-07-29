import type { Marketplace } from "@/domain/business";
import { DepopAdapter } from "./depop-connector";
import { ConnectorFactory as BaseConnectorFactory, FixtureMarketplaceAdapter, marketplaceRegistry } from "./marketplace-adapter-sdk";

let registered = false;
const fixtureMarketplaces: Exclude<Marketplace, "Manual">[] = ["eBay", "Etsy", "Mercari", "Poshmark"];

export function ensureMarketplaceAdaptersRegistered() {
  if (registered) return;
  marketplaceRegistry.register(new DepopAdapter());
  for (const marketplace of fixtureMarketplaces) marketplaceRegistry.register(new FixtureMarketplaceAdapter(marketplace));
  registered = true;
}

export const ConnectorFactory = {
  forMarketplace(marketplace: Exclude<Marketplace, "Manual">) {
    ensureMarketplaceAdaptersRegistered();
    return BaseConnectorFactory.forMarketplace(marketplace);
  },
  registeredAdapters() {
    ensureMarketplaceAdaptersRegistered();
    return BaseConnectorFactory.registeredAdapters();
  },
};

export { ConnectorError, ConnectorRuntime, FixtureMarketplaceAdapter, MarketplaceRegistry, ensureMarketplaceConnectorCollections, normalizeConnectorError, publishFailureCode, recordMarketplaceDiagnostic, recordMarketplaceSnapshot } from "./marketplace-adapter-sdk";
export type { AdapterConnectionInput, ConnectorHealth, ConnectorOperationResult, MarketplaceAdapter, MarketplaceAdapterCapabilities, MarketplaceAdapterContext, MarketplaceAdapterOperation, MarketplaceListing } from "./marketplace-adapter-sdk";
