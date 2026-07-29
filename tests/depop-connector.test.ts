import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChannelListingDraft, OperatingData } from "../domain/business";
import { configureDepopConnector, createFiveChannelDrafts, pauseOrDelistDepopDraft, publishChannelDraft, seedMarketplaceAccountsAndTemplates, syncDepopDraftQuantity } from "../lib/listings-core";
import { buildDepopPublishPayload, depopReadiness } from "../lib/depop-connector";

const time = "2026-07-28T00:00:00.000Z";

function fixture(): OperatingData {
  const productId = "11111111-1111-4111-8111-111111111111";
  const variantId = "22222222-2222-4222-8222-222222222222";
  return {
    version: 1,
    mode: "local",
    updatedAt: time,
    products: [{ id: productId, title: "Depop Production Tee", category: "T-shirt", tags: ["tee"], image: "https://img.example.test/front.jpg", images: ["https://img.example.test/front.jpg", "https://img.example.test/back.jpg"], description: "A complete Depop-ready product.", status: "active", createdAt: time, updatedAt: time }],
    variants: [{ id: variantId, productId, sku: "FST-DEPOP-001", title: "Black / L", condition: "New with tags", landedUnitCost: 12, defaultSalePrice: 48, weightOz: 10, reorderPoint: 1, reorderQuantity: 4, active: true }],
    locations: [],
    balances: [{ id: "33333333-3333-4333-8333-333333333333", variantId, onHand: 3, reserved: 0, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 }],
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

function depopDraft(data: OperatingData): ChannelListingDraft {
  seedMarketplaceAccountsAndTemplates(data);
  createFiveChannelDrafts(data, { variantId: data.variants[0].id, imageUrls: data.products[0].images });
  const draft = data.channelListingDrafts!.find((entry) => entry.marketplace === "Depop")!;
  draft.attributes = { ...draft.attributes, color: "black, white", condition: "New with tags", department: "menswear", brand: "Faust Test", nationalShippingCost: "5.5" };
  return draft;
}

test("Depop connector translates approved marketplace drafts without Product inference", () => {
  const data = fixture();
  const draft = depopDraft(data);

  const payload = buildDepopPublishPayload(draft);

  assert.equal(payload.description, draft.description);
  assert.equal(payload.price_amount, "48.00");
  assert.equal(payload.product_type, "tshirts");
  assert.equal(payload.condition, "brand_new");
  assert.deepEqual(payload.pictures, draft.imageUrls.map((url) => ({ url })));
  assert.deepEqual(payload.colour, ["black", "white"]);
});

test("Depop connector connection stores credential references without raw secrets", () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);

  configureDepopConnector(data, { displayName: "Depop production", tokenRef: "env:DEPOP_API_KEY", scopes: ["products_read", "products_write"] });

  const credential = data.marketplaceConnectorCredentials?.[0];
  assert.equal(credential?.tokenRef, "env:DEPOP_API_KEY");
  assert.equal(credential?.status, "validated");
  assert.ok(!JSON.stringify(credential).includes("pak_"));
  assert.equal(data.marketplaceAccounts?.find((entry) => entry.marketplace === "Depop")?.status, "connected");
  assert.equal(depopReadiness(data).configured, true);
});

test("Depop connector fixture publish persists external identity, snapshot, and diagnostics", async () => {
  const data = fixture();
  const draft = depopDraft(data);

  await publishChannelDraft(data, { draftId: draft.id });

  assert.equal(draft.status, "published");
  assert.equal(draft.syncState, "clean");
  assert.match(draft.externalUrl || "", /^https:\/\/www\.depop\.com\/products\//);
  assert.equal(data.marketplaceListingSnapshots?.[0].externalListingId, draft.externalListingId);
  assert.equal(data.marketplaceConnectorDiagnostics?.[0].status, "succeeded");
  assert.equal(data.listings.find((entry) => entry.id === draft.listingId)?.syncState, "connected");
});

test("Depop connector fixture sync and end operations persist diagnostics without Product mutation", async () => {
  const data = fixture();
  const draft = depopDraft(data);
  await publishChannelDraft(data, { draftId: draft.id });

  await syncDepopDraftQuantity(data, { draftId: draft.id, quantity: 2 });
  assert.equal(draft.quantity, 2);
  assert.equal(draft.syncState, "clean");
  assert.ok(data.marketplaceConnectorDiagnostics?.some((entry) => entry.operation === "sync_inventory" && entry.status === "succeeded"));

  await pauseOrDelistDepopDraft(data, { draftId: draft.id, mode: "delist", reason: "Fixture end listing" });
  assert.equal(draft.status, "delisted");
  assert.equal(data.products[0].status, "active");
  assert.ok(data.marketplaceConnectorDiagnostics?.some((entry) => entry.operation === "end" && entry.status === "succeeded"));
});

test("Depop production mode fails safely when credentials are missing", async () => {
  const data = fixture();
  const draft = depopDraft(data);
  const originalMode = process.env.DEPOP_CONNECTOR_MODE;
  const originalKey = process.env.DEPOP_API_KEY;
  process.env.DEPOP_CONNECTOR_MODE = "sandbox";
  delete process.env.DEPOP_API_KEY;
  try {
    await publishChannelDraft(data, { draftId: draft.id });
  } finally {
    if (originalMode === undefined) delete process.env.DEPOP_CONNECTOR_MODE; else process.env.DEPOP_CONNECTOR_MODE = originalMode;
    if (originalKey === undefined) delete process.env.DEPOP_API_KEY; else process.env.DEPOP_API_KEY = originalKey;
  }

  assert.equal(draft.status, "failed");
  assert.equal(data.marketplaceConnectorDiagnostics?.[0].failureCode, "credentials_missing");
  assert.ok(data.listingReviewItems?.some((entry) => entry.status === "open" && entry.marketplace === "Depop"));
});
