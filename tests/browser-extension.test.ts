import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { analyzeExtensionProduct, applyExtensionAction, importExtensionProduct, marketplaceFormMapping } from "../lib/browser-extension";
import { extensionActionSchema } from "../lib/validation/requests";

const sourceProduct = {
  source: "1688",
  importedAt: "2026-07-01T00:00:00.000Z",
  title: "1688 Heavyweight Hoodie",
  superbuyUrl: "https://detail.1688.com/offer/123.html",
  supplier: "Hangzhou Factory",
  storeName: "Hangzhou Factory Store",
  images: ["https://img.example.test/hoodie.jpg"],
  variants: [{ id: "black-l", name: "Black / L", options: ["Black", "L"], price: 118 }],
  price: 118,
  domesticShipping: 12,
  minimumOrderQuantity: 3,
  weight: "650g",
  sellerRating: 4.8,
  salesCount: 1200,
  pageTimestamp: "2026-07-01T00:00:00.000Z",
};

const fixture = (): OperatingData => ({ version: 1, mode: "local", updatedAt: "2026-07-01T00:00:00.000Z", products: [], variants: [], locations: [], balances: [], stockMovements: [], suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [], purchaseBatches: [], landedCostComponents: [], marketplaceAccounts: [], listingTemplates: [], channelListingDrafts: [], listingSyncJobs: [], listingReviewItems: [], physicalSkuMappings: [], outboxEvents: [], durableJobs: [], channelSyncStates: [], inventoryRiskLocks: [] });

test("extension parser and profitability calculate landed economics", () => {
  const analysis = analyzeExtensionProduct(sourceProduct, { rmbUsdRate: 0.14, quantity: 3, targetSalePriceUsd: 65 });
  assert.equal(analysis.product.source, "1688");
  assert.equal(analysis.purchaseCostUsd, 16.52);
  assert.ok(analysis.landedUnitCost > analysis.purchaseCostUsd);
  assert.equal(analysis.byMarketplace.length, 5);
  assert.ok(analysis.byMarketplace.find((entry) => entry.marketplace === "Depop")?.expectedProfit);
});

test("extension import is approved, idempotent, and creates five channel drafts", () => {
  const data = fixture();
  assert.throws(() => applyExtensionAction(data, { action: "import-product", product: sourceProduct, approved: false }), /approved/);
  const result = importExtensionProduct(data, sourceProduct, { rmbUsdRate: 0.14, quantity: 3 }, "import-once");
  assert.equal(result.idempotent, false);
  assert.equal(data.suppliers.length, 1);
  assert.equal(data.variants.length, 1);
  assert.equal(data.purchaseBatches?.length, 1);
  assert.equal(data.channelListingDrafts?.length, 5);
  const second = importExtensionProduct(data, sourceProduct, { rmbUsdRate: 0.14, quantity: 3 }, "import-once");
  assert.equal(second.idempotent, true);
  assert.equal(data.products.length, 1);
});

test("extension messages validate and marketplace mapping exposes fillable fields", () => {
  const parsed = extensionActionSchema.parse({ action: "analyze", product: sourceProduct, assumptions: { rmbUsdRate: 0.14 } });
  assert.equal(parsed.action, "analyze");
  assert.throws(() => extensionActionSchema.parse({ action: "confirm-publish", draftId: crypto.randomUUID(), externalUrl: "not-url", externalListingId: "x" }));
  const data = fixture();
  importExtensionProduct(data, sourceProduct, { targetSalePriceUsd: 65 }, "mapping");
  const draft = data.channelListingDrafts![0];
  const mapping = marketplaceFormMapping(draft);
  assert.equal(mapping.title, draft.title);
  assert.equal(mapping.sku, draft.physicalSku);
  assert.ok(mapping.images.length);
});

test("extension confirmation, sync, pause, delist, and failure reporting are auditable", () => {
  const data = fixture();
  importExtensionProduct(data, sourceProduct, { targetSalePriceUsd: 65 }, "confirm");
  const draft = data.channelListingDrafts![0];
  applyExtensionAction(data, { action: "create-publish-job", draftId: draft.id, idempotencyKey: crypto.randomUUID() });
  applyExtensionAction(data, { action: "confirm-publish", draftId: draft.id, externalListingId: "DEMO-EXT-1", externalUrl: "https://depop.com/products/demo-ext-1", finalTitle: "Final title", finalPrice: 66 });
  assert.equal(data.channelListingDrafts![0].externalListingId, "DEMO-EXT-1");
  applyExtensionAction(data, { action: "sync-quantity", draftId: draft.id, quantity: 2 });
  applyExtensionAction(data, { action: "pause-draft", draftId: draft.id, reason: "Phase 1 sync test" });
  applyExtensionAction(data, { action: "delist-draft", draftId: draft.id, reason: "Phase 1 delist test" });
  const review = applyExtensionAction(data, { action: "report-error", draftId: draft.id, marketplace: draft.marketplace, reason: "Selector changed" });
  assert.equal((review as { reason: string }).reason, "sync_failed");
  assert.ok(data.activity.some((entry) => entry.action.includes("Extension")));
});
