import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChannelListingDraft, OperatingData } from "../domain/business";
import { ConnectorFactory, ensureMarketplaceAdaptersRegistered } from "../lib/marketplace-adapter-platform";
import { ConnectorError, ConnectorRuntime, FixtureMarketplaceAdapter, marketplaceRegistry, recordMarketplaceDiagnostic, recordMarketplaceSnapshot } from "../lib/marketplace-adapter-sdk";

const time = "2026-07-29T00:00:00.000Z";
const fixtureEnv = { NODE_ENV: "test" } as NodeJS.ProcessEnv;

function fixtureData(): OperatingData {
  const productId = "11111111-1111-4111-8111-111111111111";
  const variantId = "22222222-2222-4222-8222-222222222222";
  return {
    version: 1,
    mode: "local",
    updatedAt: time,
    products: [{ id: productId, title: "Adapter Platform Tee", category: "T-shirt", tags: ["tee"], image: "https://img.example.test/front.jpg", images: ["https://img.example.test/front.jpg"], description: "Adapter platform test product.", status: "active", createdAt: time, updatedAt: time }],
    variants: [{ id: variantId, productId, sku: "FST-ADAPTER-001", title: "Black / L", condition: "New with tags", landedUnitCost: 12, defaultSalePrice: 48, weightOz: 10, reorderPoint: 1, reorderQuantity: 4, active: true }],
    locations: [],
    balances: [],
    stockMovements: [],
    suppliers: [],
    purchaseOrders: [],
    parcels: [],
    listings: [],
    customers: [],
    orders: [],
    transactions: [],
    tasks: [],
    notices: [],
    insights: [],
    activity: [],
  };
}

function draft(marketplace: ChannelListingDraft["marketplace"] = "Depop"): ChannelListingDraft {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    listingId: "44444444-4444-4444-8444-444444444444",
    variantId: "22222222-2222-4222-8222-222222222222",
    physicalSku: "FST-ADAPTER-001",
    marketplace,
    title: "Adapter Platform Tee",
    description: "A complete marketplace-ready draft generated from Product Knowledge.",
    price: 48,
    category: "T-shirt",
    attributes: { condition: "New with tags", currency: "USD", color: "black" },
    imageUrls: ["https://img.example.test/front.jpg"],
    quantity: 2,
    status: "validated",
    validationErrors: [],
    publishMode: "adapter",
    syncState: "clean",
    createdAt: time,
    updatedAt: time,
  };
}

test("Marketplace Adapter Platform registers Depop plus fixture adapters without workflow switches", () => {
  ensureMarketplaceAdaptersRegistered();
  const adapters = ConnectorFactory.registeredAdapters();
  assert.ok(adapters.some((adapter) => adapter.marketplace === "Depop"));
  assert.ok(adapters.some((adapter) => adapter.marketplace === "eBay"));
  for (const adapter of adapters) {
    assert.equal(typeof adapter.publish, "function");
    assert.equal(typeof adapter.translateDraft, "function");
    assert.equal(typeof adapter.health, "function");
    assert.equal(typeof adapter.capabilities.supportsDraftValidation, "boolean");
  }
});

test("Connector factory returns adapters through one normalized contract", async () => {
  const data = fixtureData();
  const depop = ConnectorFactory.forMarketplace("Depop");
  const ebay = ConnectorFactory.forMarketplace("eBay");
  assert.equal(depop.marketplace, "Depop");
  assert.equal(ebay.marketplace, "eBay");
  assert.equal(depop.runtimeMode(fixtureEnv), "fixture");
  assert.equal(ebay.runtimeMode(fixtureEnv), "fixture");

  const result = await ebay.publish(draft("eBay"), { data });
  assert.match(result.externalUrl, /example\.test\/ebay/);
  assert.equal(result.listing?.status, "active");
});

test("Connector runtime normalizes duration telemetry and retryable failures", async () => {
  const adapter = new FixtureMarketplaceAdapter("Mercari", "conformance");
  const result = await ConnectorRuntime.execute(adapter, "publish", async () => ({ externalId: "M-1", externalUrl: "https://example.test/mercari/M-1", requestId: "req-1", httpStatus: 201, metadata: { ok: true } }));
  assert.equal(result.metadata.connectorVersion, adapter.connectorVersion);
  assert.equal(result.metadata.operation, "publish");
  assert.equal(typeof result.metadata.durationMs, "number");

  await assert.rejects(
    () => ConnectorRuntime.execute(adapter, "publish", async () => { throw new ConnectorError("Temporary marketplace outage.", "temporary", "marketplace_unavailable", true, 503, "req-2"); }),
    (error: unknown) => error instanceof ConnectorError && error.retryable && error.failureCode === "marketplace_unavailable" && error.metadata.operation === "publish",
  );
});

test("Shared diagnostics and listing snapshots persist marketplace-neutral records", () => {
  const data = fixtureData();
  const adapter = ConnectorFactory.forMarketplace("eBay");
  const channelDraft = draft("eBay");
  const result = { externalId: "EBAY-1", externalUrl: "https://example.test/ebay/EBAY-1", requestId: "req-ebay-1", httpStatus: 201, metadata: { mode: "fixture" } };

  recordMarketplaceDiagnostic(data, adapter, { draftId: channelDraft.id, operation: "publish", status: "succeeded", retryable: false, message: "Published.", suggestedResolution: "Monitor listing.", metadata: {} });
  recordMarketplaceSnapshot(data, adapter, channelDraft, data.products[0].id, result);

  assert.equal(data.marketplaceConnectorDiagnostics?.[0].marketplace, "eBay");
  assert.equal(data.marketplaceListingSnapshots?.[0].marketplace, "eBay");
  assert.equal(data.marketplaceListingSnapshots?.[0].externalListingId, "EBAY-1");
});

test("Marketplace registry can prove a new adapter is added without workflow code changes", async () => {
  const adapter = new FixtureMarketplaceAdapter("Poshmark", "temporary-registration");
  marketplaceRegistry.register(adapter);
  const registered = ConnectorFactory.forMarketplace("Poshmark");
  const result = await registered.sync(draft("Poshmark"), { quantity: 1 }, { data: fixtureData() });
  assert.equal(result.metadata.operation, "sync_inventory");
  assert.equal(result.listing?.inventory, 1);
});
