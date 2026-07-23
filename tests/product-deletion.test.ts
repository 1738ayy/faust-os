import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { archiveProductGraph, hardDeleteProductGraph, productDeleteDependencySummary } from "../lib/product-deletion";

const time = "2026-07-23T00:00:00.000Z";

function fixture(): OperatingData {
  return { version: 1, mode: "local", products: [], productImages: [], productDigitalTwins: [], variants: [], locations: [], balances: [], stockMovements: [], suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [], updatedAt: time };
}

test("hard product deletion removes every sibling variant dependency before the product", () => {
  const data = fixture();
  data.products.push({ id: "product-clean", title: "Clean test product", category: "T-shirt", tags: [], coverImageId: "image-cover", status: "draft", createdAt: time, updatedAt: time });
  data.variants.push(
    { id: "variant-a", productId: "product-clean", sku: "CLEAN-A", title: "Small", condition: "New", landedUnitCost: 1, defaultSalePrice: 10, reorderPoint: 0, reorderQuantity: 0, active: true },
    { id: "variant-b", productId: "product-clean", sku: "CLEAN-B", title: "Large", condition: "New", landedUnitCost: 1, defaultSalePrice: 10, reorderPoint: 0, reorderQuantity: 0, active: true },
  );
  data.productImages = [{ id: "image-cover", productId: "product-clean", url: "https://cdn.example.test/cover.jpg", position: 0, isCover: true, createdAt: time, updatedAt: time }];
  data.productDigitalTwins = [{ id: "twin-clean", productId: "product-clean", sourceImageId: "image-cover", sourceImageUrl: "https://cdn.example.test/cover.jpg", sourceImageRevision: time, transparentImageUrl: "/api/import-image?key=digital-twins/clean.png", storageKey: "digital-twins/clean.png", processingStatus: "ready", segmentationConfidence: 0.9, bounds: { x: 1, y: 1, width: 10, height: 10 }, generatedAt: time, processorVersion: "test", failureCode: null, createdAt: time, updatedAt: time }];
  data.listings.push(
    { id: "listing-a", variantId: "variant-a", marketplace: "Depop", title: "Small draft", price: 10, quantity: 0, status: "draft", syncState: "manual", createdAt: time },
    { id: "listing-b", variantId: "variant-b", marketplace: "eBay", title: "Large draft", price: 10, quantity: 0, status: "draft", syncState: "manual", createdAt: time },
  );
  data.channelListingDrafts = [{ id: "draft-b", listingId: "listing-b", variantId: "variant-b", physicalSku: "CLEAN-B", marketplace: "eBay", title: "Large draft", description: "Draft", price: 10, category: "T-shirt", attributes: {}, imageUrls: [], quantity: 0, status: "draft", validationErrors: [], publishMode: "adapter", syncState: "pending", createdAt: time, updatedAt: time }];
  data.listingSyncJobs = [{ id: "job-b", channelDraftId: "draft-b", marketplace: "eBay", action: "publish", status: "queued", attempts: 0, maxAttempts: 3, runAfter: time, createdAt: time }];
  data.listingReviewItems = [{ id: "review-b", channelDraftId: "draft-b", marketplace: "eBay", severity: "warning", reason: "validation_error", status: "open", detail: "Needs title", actionLabel: "Review", createdAt: time }];
  data.balances.push({ id: "balance-b", variantId: "variant-b", onHand: 0, reserved: 0, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 });

  const product = data.products[0];
  const summary = productDeleteDependencySummary(data, product);
  assert.equal(summary.shouldArchive, false);
  assert.deepEqual(summary.variantIds.sort(), ["variant-a", "variant-b"]);
  assert.equal(summary.listingCount, 2);

  hardDeleteProductGraph(data, product);

  assert.equal(data.products.length, 0);
  assert.equal(data.variants.length, 0);
  assert.equal(data.listings.length, 0);
  assert.equal(data.channelListingDrafts?.length, 0);
  assert.equal(data.listingSyncJobs?.length, 0);
  assert.equal(data.listingReviewItems?.length, 0);
  assert.equal(data.balances.length, 0);
  assert.equal(data.productImages?.length, 0);
  assert.equal(data.productDigitalTwins?.length, 0);
});

test("products with operating history archive the whole product graph instead of hard deleting", () => {
  const data = fixture();
  data.products.push({ id: "product-history", title: "History product", category: "T-shirt", tags: [], status: "active", createdAt: time, updatedAt: time });
  data.variants.push(
    { id: "variant-history-a", productId: "product-history", sku: "HISTORY-A", title: "Small", condition: "New", landedUnitCost: 1, defaultSalePrice: 10, reorderPoint: 0, reorderQuantity: 0, active: true },
    { id: "variant-history-b", productId: "product-history", sku: "HISTORY-B", title: "Large", condition: "New", landedUnitCost: 1, defaultSalePrice: 10, reorderPoint: 0, reorderQuantity: 0, active: true },
  );
  data.listings.push({ id: "listing-history", variantId: "variant-history-b", marketplace: "Depop", title: "Live listing", price: 10, quantity: 2, status: "active", syncState: "connected", createdAt: time });

  const product = data.products[0];
  const variants = data.variants.filter((entry) => entry.productId === product.id);
  const summary = productDeleteDependencySummary(data, product);
  assert.equal(summary.shouldArchive, true);

  archiveProductGraph(data, product, variants, "2026-07-23T01:00:00.000Z");

  assert.equal(data.products.length, 1);
  assert.equal(data.products[0].status, "paused");
  assert.ok(data.variants.every((variant) => variant.active === false));
  assert.equal(data.listings[0].status, "paused");
  assert.equal(data.listings[0].quantity, 0);
});
