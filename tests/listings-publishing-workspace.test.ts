import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { buildListingsPublishingWorkspace, createCrossListingPublishJob, createFiveChannelDrafts, createProductListingSyncReview, inspectProductMarketplaceDraft, resetMarketplaceDraftField, retryMarketplacePublishTask, saveDraftImageOrder, saveMarketplaceDraftField, seedMarketplaceAccountsAndTemplates, upsertMarketplaceAccountDefault, upsertProductMarketplaceOverride } from "../lib/listings-core";
import { buildCrossListingComposerModel } from "../lib/listings/composer";

const fixture = (): OperatingData => {
  const time = new Date().toISOString();
  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  return {
    version: 1,
    mode: "local",
    updatedAt: time,
    products: [{ id: productId, title: "Vintage wash heavyweight hoodie", category: "Streetwear hoodie", tags: ["hoodie", "vintage"], image: "https://example.test/hoodie-cover.png", images: ["https://example.test/hoodie-cover.png", "https://example.test/hoodie-detail.png"], description: "Heavyweight charcoal hoodie with vintage wash.", status: "active", createdAt: time, updatedAt: time }],
    productImages: [
      { id: crypto.randomUUID(), productId, url: "https://example.test/hoodie-cover.png", position: 0, isCover: true, purpose: "cover", sourceType: "supplier", createdAt: time },
      { id: crypto.randomUUID(), productId, url: "https://example.test/hoodie-detail.png", position: 1, isCover: false, purpose: "detail", sourceType: "supplier", createdAt: time },
    ],
    variants: [{ id: variantId, productId, sku: "FST-HOOD-001", title: "Charcoal / L", condition: "New with tags", landedUnitCost: 31.7, defaultSalePrice: 86, weightOz: 22, reorderPoint: 2, reorderQuantity: 8, active: true }],
    locations: [],
    balances: [{ id: crypto.randomUUID(), variantId, onHand: 4, reserved: 1, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 }],
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
};

test("Listings 2.0 applies account defaults, category defaults, and product overrides in precedence order", () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);
  const variant = data.variants[0];
  const product = data.products[0];
  const account = data.marketplaceAccounts!.find((entry) => entry.marketplace === "Depop")!;
  const categoryId = inspectProductMarketplaceDraft(data, { variantId: variant.id, marketplace: "Depop" }).universalInput.identity.categoryId;

  upsertMarketplaceAccountDefault(data, { marketplaceAccountId: account.id, fieldKey: "shippingService", value: "USPS Ground Advantage" });
  upsertMarketplaceAccountDefault(data, { marketplaceAccountId: account.id, universalCategoryId: categoryId, fieldKey: "shippingService", value: "Depop clothing shipping" });
  let inspector = inspectProductMarketplaceDraft(data, { variantId: variant.id, marketplace: "Depop" });
  assert.equal(inspector.defaultsApplied.find((field) => field.fieldKey === "shippingService")?.value, "Depop clothing shipping");

  upsertProductMarketplaceOverride(data, { productId: product.id, variantId: variant.id, marketplace: "Depop", marketplaceAccountId: account.id, fieldKey: "shippingService", value: "Creator-paid upgraded shipping" });
  upsertProductMarketplaceOverride(data, { productId: product.id, variantId: variant.id, marketplace: "Depop", marketplaceAccountId: account.id, fieldKey: "price", value: 99 });
  inspector = inspectProductMarketplaceDraft(data, { variantId: variant.id, marketplace: "Depop" });
  assert.equal(inspector.overridesApplied.find((field) => field.fieldKey === "shippingService")?.value, "Creator-paid upgraded shipping");
  assert.equal(inspector.overridesApplied.find((field) => field.fieldKey === "price")?.value, 99);
});

test("Listings 2.0 product workspace summarizes product coverage, readiness, and published records", () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);
  createCrossListingPublishJob(data, { productId: data.products[0].id, marketplaces: ["Depop", "eBay", "Etsy"], inventoryStrategy: "shared", idempotencyKey: crypto.randomUUID() });
  const workspace = buildListingsPublishingWorkspace(data);
  assert.equal(workspace.products.length, 1);
  assert.equal(workspace.products[0].marketplaceCoverage.length, 5);
  assert.ok(workspace.products[0].marketplaceCoverage.some((entry) => entry.marketplace === "Depop"));
  assert.ok(workspace.publishingQueue.length >= 1);
  assert.ok(workspace.publishedListings.some((entry) => entry.draft.marketplace === "Depop" || entry.draft.marketplace === "eBay"));
});

test("Listings 2.0 publish jobs are idempotent, partial, retryable, and risk-lock aware", () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);
  const key = crypto.randomUUID();
  createCrossListingPublishJob(data, { productId: data.products[0].id, marketplaces: ["Depop", "Etsy", "Poshmark"], idempotencyKey: key });
  createCrossListingPublishJob(data, { productId: data.products[0].id, marketplaces: ["Depop", "Etsy", "Poshmark"], idempotencyKey: key });
  createCrossListingPublishJob(data, { productId: data.products[0].id, marketplaces: ["Depop", "Etsy", "Poshmark"], idempotencyKey: crypto.randomUUID() });
  assert.equal(data.crossListingJobs?.length, 1);
  assert.ok(data.marketplacePublishTasks!.some((task) => task.status === "published"));
  assert.ok(data.marketplacePublishTasks!.some((task) => task.status === "queued"));

  const queued = data.marketplacePublishTasks!.find((task) => task.status === "queued")!;
  queued.status = "failed";
  queued.failureCode = "network_timeout";
  queued.failureMessage = "Temporary marketplace timeout.";
  queued.retryable = true;
  retryMarketplacePublishTask(data, { taskId: queued.id });
  assert.equal(queued.status, "queued");
  assert.equal(queued.failureCode, null);

  const riskData = fixture();
  seedMarketplaceAccountsAndTemplates(riskData);
  riskData.inventoryRiskLocks = [{ id: crypto.randomUUID(), variantId: riskData.variants[0].id, reason: "oversell_risk", status: "active", lockedQuantity: 1, createdAt: new Date().toISOString() }];
  createCrossListingPublishJob(riskData, { productId: riskData.products[0].id, marketplaces: ["Depop"], idempotencyKey: crypto.randomUUID() });
  assert.equal(riskData.marketplacePublishTasks?.[0].failureCode, "risk_lock");
});

test("Listings 2.0 composer can edit legacy drafts before editable fields are materialized", () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);
  createFiveChannelDrafts(data, { variantId: data.variants[0].id, imageUrls: data.products[0].images });
  const draft = data.channelListingDrafts!.find((entry) => entry.marketplace === "Depop")!;
  data.marketplaceListingDraftFields = data.marketplaceListingDraftFields!.filter((field) => field.draftId !== draft.id);

  const saved = saveMarketplaceDraftField(data, { draftId: draft.id, fieldKey: "title", currentValue: "Legacy draft edited from composer", actor: "tester" });

  assert.equal(saved.generatedValue, "Vintage wash heavyweight hoodie - FST-HOOD-001");
  assert.equal(saved.currentValue, "Legacy draft edited from composer");
  assert.equal(draft.title, "Legacy draft edited from composer");
  assert.equal(data.marketplaceListingDraftFields!.filter((field) => field.draftId === draft.id && field.fieldKey === "title").length, 1);
});

test("Listings 2.0 creates controlled sync reviews instead of overwriting published marketplace values", () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);
  createProductListingSyncReview(data, { productId: data.products[0].id, fieldKey: "price", previousValue: "$86.00", suggestedValue: "$94.00", marketplaces: ["Depop", "Mercari"] });
  assert.equal(data.productListingSyncReviews?.length, 2);
  assert.deepEqual(data.productListingSyncReviews?.map((entry) => entry.status), ["open", "open"]);
  assert.ok(data.activity.some((entry) => entry.action === "Listing sync review created"));
});

test("Listings 2.0 persists editable draft fields with provenance and reset-to-generated behavior", () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);
  createFiveChannelDrafts(data, { variantId: data.variants[0].id, imageUrls: data.products[0].images });
  const draft = data.channelListingDrafts!.find((entry) => entry.marketplace === "Depop")!;
  const titleField = data.marketplaceListingDraftFields!.find((entry) => entry.draftId === draft.id && entry.fieldKey === "title")!;
  assert.equal(titleField.source, "mapping");
  assert.ok(titleField.sourcePath?.includes("title"));
  assert.equal(titleField.isOverridden, false);

  saveMarketplaceDraftField(data, { draftId: draft.id, fieldKey: "title", currentValue: "Vintage wash hoodie - Depop exclusive", actor: "tester" });
  assert.equal(draft.title, "Vintage wash hoodie - Depop exclusive");
  assert.equal(data.marketplaceListingDraftFields!.find((entry) => entry.id === titleField.id)?.source, "user_edit");
  assert.equal(data.marketplaceListingDraftRevisions?.at(-1)?.reason, "user_edit");

  resetMarketplaceDraftField(data, { draftId: draft.id, fieldKey: "title", actor: "tester" });
  assert.equal(draft.title, titleField.generatedValue);
  assert.equal(data.marketplaceListingDraftFields!.find((entry) => entry.id === titleField.id)?.isOverridden, false);
});

test("Listings 2.0 persists marketplace image order without duplicating assets", () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);
  createFiveChannelDrafts(data, { variantId: data.variants[0].id, imageUrls: data.products[0].images });
  const images = data.productImages!;
  saveDraftImageOrder(data, { productId: data.products[0].id, marketplace: "Mercari", imageIds: [images[1].id, images[0].id], coverImageId: images[1].id });
  const order = data.marketplaceImageOrders![0];
  assert.deepEqual(order.imageIds, [images[1].id, images[0].id]);
  assert.equal(data.productImages!.length, 2);
  const draft = data.channelListingDrafts!.find((entry) => entry.marketplace === "Mercari")!;
  assert.deepEqual(draft.imageUrls, [images[1].url, images[0].url]);
});

test("Listings 2.0 composer restores persisted fields after repository reload and excludes archived products", () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);
  createCrossListingPublishJob(data, { productId: data.products[0].id, marketplaces: ["Depop"], idempotencyKey: crypto.randomUUID() });
  const draft = data.channelListingDrafts!.find((entry) => entry.marketplace === "Depop")!;
  saveMarketplaceDraftField(data, { draftId: draft.id, fieldKey: "description", currentValue: "Saved marketplace-specific description." });
  const reloaded = JSON.parse(JSON.stringify(data)) as OperatingData;
  const composer = buildCrossListingComposerModel(reloaded, { variantId: reloaded.variants[0].id, marketplace: "Depop" });
  assert.equal(composer.fields.find((entry) => entry.fieldKey === "description")?.currentValue, "Saved marketplace-specific description.");

  reloaded.products[0].status = "paused";
  const workspace = buildListingsPublishingWorkspace(reloaded);
  assert.equal(workspace.products.length, 0);
});

test("Listings 2.0 durable publish tasks survive restart and retry only the failed marketplace", () => {
  const data = fixture();
  seedMarketplaceAccountsAndTemplates(data);
  createCrossListingPublishJob(data, { productId: data.products[0].id, marketplaces: ["Depop", "Mercari"], idempotencyKey: crypto.randomUUID() });
  const reloaded = JSON.parse(JSON.stringify(data)) as OperatingData;
  const publishedBefore = reloaded.marketplacePublishTasks!.filter((entry) => entry.status === "published").length;
  const failed = reloaded.marketplacePublishTasks!.find((entry) => entry.status === "queued")!;
  failed.status = "failed";
  failed.failureCode = "network_timeout";
  failed.failureMessage = "Temporary timeout.";
  failed.retryable = true;
  retryMarketplacePublishTask(reloaded, { taskId: failed.id });
  assert.equal(reloaded.marketplacePublishTasks!.filter((entry) => entry.status === "published").length, publishedBefore);
  assert.equal(failed.status, "queued");
  assert.equal(failed.attemptCount, 2);
});
