import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import type { SuperbuyProduct } from "../types/superbuy-product";
import { importExtensionProduct } from "../lib/browser-extension";
import { applyProductKnowledgeDecision, buildProductKnowledgeFromSuperbuy, productKnowledgeSummary, productKnowledgeValue } from "../lib/product-knowledge";
import { createFiveChannelDrafts, inspectProductMarketplaceDraft } from "../lib/listings-core";

const time = "2026-07-27T00:00:00.000Z";

function fixture(): OperatingData {
  return { version: 1, mode: "local", updatedAt: time, products: [], productImages: [], productDigitalTwins: [], productKnowledgeEvidence: [], productKnowledgeFields: [], productKnowledgeDecisions: [], productKnowledgeMemory: [], productKnowledgeConfidenceHistory: [], variants: [], locations: [], balances: [], stockMovements: [], suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [], purchaseBatches: [], landedCostComponents: [], marketplaceAccounts: [], listingTemplates: [], channelListingDrafts: [], listingSyncJobs: [], listingReviewItems: [], physicalSkuMappings: [], outboxEvents: [], durableJobs: [], deadLetters: [], channelSyncStates: [], inventoryRiskLocks: [] };
}

const sourceProduct: SuperbuyProduct = {
  source: "1688",
  importedAt: time,
  title: "Cross-border heavyweight graphic T-shirt",
  superbuyUrl: "https://detail.1688.com/offer/knowledge-1.html",
  original1688Url: "https://detail.1688.com/offer/knowledge-1.html",
  storeName: "Shangrao Nanxi Clothing Co., Ltd",
  category: "Item",
  rawAttributes: {
    "Product Category": "T-shirt",
    "Main Fabric Composition": "Cotton blend",
  },
  images: ["https://img.example.test/front.jpg", "https://img.example.test/back.jpg"],
  variants: [
    { id: "black-l", name: "Black / L", options: ["Black", "L"], price: 18, stock: 15 },
    { id: "white-xl", name: "White / XL", options: ["White", "XL"], price: 19, stock: 9 },
  ],
  variantOptions: { colors: ["Black", "White"], sizes: ["L", "XL"] },
  price: 18,
  domesticShipping: 6,
  weight: "260g",
};

test("Product Knowledge normalizes Superbuy source labels into evidence-backed fields", () => {
  const data = fixture();
  data.products.push({ id: "11111111-1111-4111-8111-111111111111", title: sourceProduct.title, category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });

  const summary = buildProductKnowledgeFromSuperbuy(data, data.products[0].id, sourceProduct);

  assert.equal(productKnowledgeValue(data, data.products[0].id, "material"), "Cotton blend");
  assert.equal(productKnowledgeValue(data, data.products[0].id, "universal_category"), "T-shirt");
  assert.equal(productKnowledgeValue(data, data.products[0].id, "supplier_shop"), "Shangrao Nanxi Clothing Co., Ltd");
  assert.equal((productKnowledgeValue(data, data.products[0].id, "variant_options") as { variants: unknown[] }).variants.length, 2);
  assert.ok(summary.evidence.some((entry) => entry.sourceLabel === "Main Fabric Composition" && entry.normalizedFieldKey === "material"));
  assert.ok(summary.completeness.find((entry) => entry.label === "Identity")?.score);
});

test("Product Knowledge decisions persist corrections and create reusable memory", () => {
  const data = fixture();
  const productId = "22222222-2222-4222-8222-222222222222";
  data.products.push({ id: productId, title: sourceProduct.title, category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, productId, sourceProduct);

  applyProductKnowledgeDecision(data, { productId, fieldKey: "material", decision: "corrected", value: "100% cotton", actor: "test" });

  assert.equal(productKnowledgeValue(data, productId, "material"), "100% cotton");
  assert.equal(data.productKnowledgeDecisions?.length, 1);
  assert.ok(data.productKnowledgeMemory?.some((memory) => memory.memoryType === "material_mapping" && memory.pattern === "Cotton blend" && memory.output === "100% cotton"));

  const nextProductId = "33333333-3333-4333-8333-333333333333";
  data.products.push({ id: nextProductId, title: "Another tee", category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, nextProductId, { ...sourceProduct, title: "Another tee", superbuyUrl: "https://detail.1688.com/offer/knowledge-2.html" });

  const field = productKnowledgeSummary(data, nextProductId).fields.find((entry) => entry.fieldKey === "material");
  assert.equal(field?.value, "100% cotton");
  assert.equal(field?.source, "memory");
});

test("Marketplace drafts consume corrected Product Knowledge and preserve provenance", () => {
  const data = fixture();
  const result = importExtensionProduct(data, sourceProduct, { rmbUsdRate: 0.14, quantity: 2 }, "knowledge-draft");
  assert.ok(result.variantId);
  applyProductKnowledgeDecision(data, { productId: result.productId, fieldKey: "suggested_title", decision: "corrected", value: "Approved Faust T-shirt Title", actor: "test" });
  data.channelListingDrafts = [];
  data.listings = [];
  data.physicalSkuMappings = [];
  data.outboxEvents = [];
  data.durableJobs = [];
  data.listingSyncJobs = [];

  createFiveChannelDrafts(data, { variantId: result.variantId, idempotencyKey: "knowledge-draft-regenerated" });
  const depop = data.channelListingDrafts?.find((draft) => draft.marketplace === "Depop");
  assert.ok(depop);
  assert.match(depop.title, /Approved Faust T-shirt Title/);

  const inspector = inspectProductMarketplaceDraft(data, { variantId: result.variantId, marketplace: "Depop" });
  const titleField = inspector.mappingSources.find((field) => field.fieldKey === "title");
  assert.equal(titleField?.source, "product");
  assert.equal(titleField?.sourcePath, "productKnowledge.suggested_title");
});
