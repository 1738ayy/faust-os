import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { coordinateSoldItem, createFiveChannelDrafts, listingsSummary, publishChannelDraft, seedMarketplaceAccountsAndTemplates, syncDraftQuantity } from "../lib/listings-core";

const fixture = (): OperatingData => {
  const time = new Date().toISOString();
  const productId = crypto.randomUUID(), variantId = crypto.randomUUID(), balanceId = crypto.randomUUID(), customerId = crypto.randomUUID();
  return {
    version: 1, mode: "local", updatedAt: time,
    products: [{ id: productId, title: "Vintage wash heavyweight hoodie", category: "Streetwear", tags: ["hoodie"], image: "/hoodie.png", status: "active", createdAt: time, updatedAt: time }],
    variants: [{ id: variantId, productId, sku: "FST-HOOD-001", title: "Charcoal / L", condition: "New with tags", landedUnitCost: 31.7, defaultSalePrice: 86, reorderPoint: 2, reorderQuantity: 8, active: true }],
    locations: [], balances: [{ id: balanceId, variantId, onHand: 3, reserved: 1, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 }], stockMovements: [],
    suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [{ id: customerId, name: "Buyer", orderCount: 0, lifetimeValue: 0, issueCount: 0 }], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [],
  };
};

test("listings core creates five channel drafts and coordinates publishing, sync, and sold delists", async () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);
  assert.equal(data.marketplaceAccounts?.length, 5);
  createFiveChannelDrafts(data, { variantId: data.variants[0].id, physicalSku: "PHY-HOOD-L", basePrice: 90, imageUrls: ["/hoodie.png"], idempotencyKey: crypto.randomUUID() });
  assert.equal(data.channelListingDrafts?.length, 5);
  assert.deepEqual(data.channelListingDrafts?.map((draft) => draft.marketplace).sort(), ["Depop", "Etsy", "Mercari", "Poshmark", "eBay"].sort());
  assert.equal(data.physicalSkuMappings?.length, 5);
  assert.ok(data.listingReviewItems?.some((item) => item.reason === "manual_publish_required"));

  const depop = data.channelListingDrafts!.find((draft) => draft.marketplace === "Depop")!;
  await publishChannelDraft(data, { draftId: depop.id, idempotencyKey: crypto.randomUUID() });
  assert.equal(depop.status, "published");
  assert.ok(depop.externalListingId);

  syncDraftQuantity(data, { draftId: depop.id, quantity: 99, idempotencyKey: crypto.randomUUID() });
  assert.equal(depop.syncState, "risk_locked");
  assert.ok(data.inventoryRiskLocks?.some((lock) => lock.reason === "oversell_risk"));

  coordinateSoldItem(data, { draftId: depop.id, idempotencyKey: crypto.randomUUID() });
  assert.equal(depop.status, "sold");
  assert.equal(data.channelListingDrafts!.filter((draft) => draft.status === "delisted").length, 4);
  assert.ok(data.listingSyncJobs?.some((job) => job.action === "sold_coordination"));
  const summary = listingsSummary(data);
  assert.equal(summary.drafts, 5);
  assert.ok(summary.openReviews >= 1);
});
