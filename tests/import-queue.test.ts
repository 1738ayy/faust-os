import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { buildImportQueue, markImportQueueItemCompleted, removeImportQueueItems } from "../lib/import-queue";

const product = (title: string, superbuyUrl: string, images: string[] = []) => ({
  source: "1688",
  importedAt: "2026-07-20T00:00:00.000Z",
  title,
  superbuyUrl,
  supplier: "Supplier",
  storeName: "Supplier Store",
  category: "T-shirt",
  images,
  variants: [{ id: "black-l", name: "Black / L", options: ["Black", "L"], image: "https://cbu01.alicdn.com/img/variant.jpg", price: 12, stock: 10 }],
  price: 12,
});

function fixture(): OperatingData {
  return {
    version: 1,
    mode: "local",
    updatedAt: "2026-07-20T00:00:00.000Z",
    products: [],
    variants: [],
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
    extensionArtifacts: [
      { id: "11111111-1111-4111-8111-111111111111", type: "log", storageProvider: "local_metadata", metadata: { kind: "latest_source_scan", product: product("First scan", "https://detail.1688.com/offer/1.html", ["https://cbu01.alicdn.com/img/one.jpg"]) }, createdAt: "2026-07-20T00:00:00.000Z" },
      { id: "22222222-2222-4222-8222-222222222222", type: "log", storageProvider: "local_metadata", metadata: { kind: "latest_source_scan", product: product("Second scan", "https://detail.1688.com/offer/2.html") }, createdAt: "2026-07-20T00:01:00.000Z" },
      { id: "33333333-3333-4333-8333-333333333333", type: "log", storageProvider: "local_metadata", metadata: { kind: "latest_source_scan", queueStatus: "completed", product: product("Completed scan", "https://detail.1688.com/offer/3.html") }, createdAt: "2026-07-20T00:02:00.000Z" },
    ],
  };
}

test("import queue excludes completed items from active counts and preserves image candidates", () => {
  const data = fixture();
  const queue = buildImportQueue(data);
  assert.equal(queue.counts.active, 2);
  assert.equal(queue.counts.completed, 1);
  assert.equal(queue.scans.length, 2);
  assert.equal(queue.scans[0].title, "First scan");
  assert.deepEqual(queue.scans[0].imageCandidates, ["https://cbu01.alicdn.com/img/one.jpg", "https://cbu01.alicdn.com/img/variant.jpg"]);
  assert.equal(queue.scans[1].imageCandidates[0], "https://cbu01.alicdn.com/img/variant.jpg");
});

test("removing queue items deletes only source scan artifacts", () => {
  const data = fixture();
  data.products.push({ id: "99999999-9999-4999-8999-999999999999", title: "Existing product", category: "T-shirt", tags: [], sourceUrl: "https://detail.1688.com/offer/1.html", status: "draft", createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z" });
  const result = removeImportQueueItems(data, ["11111111-1111-4111-8111-111111111111"]);
  assert.equal(result.removed, 1);
  assert.equal(data.products.length, 1);
  assert.ok(!data.extensionArtifacts?.some((artifact) => artifact.id === "11111111-1111-4111-8111-111111111111"));
});

test("marking a queue item completed removes it from the active sourcing inbox", () => {
  const data = fixture();
  const marked = markImportQueueItemCompleted(data, "22222222-2222-4222-8222-222222222222", "product-2");
  assert.equal(marked, true);
  const queue = buildImportQueue(data);
  assert.equal(queue.counts.active, 1);
  assert.equal(queue.counts.completed, 2);
  assert.ok(!queue.scans.some((item) => item.id === "22222222-2222-4222-8222-222222222222"));
});
