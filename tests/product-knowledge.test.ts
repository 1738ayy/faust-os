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
  priceCurrency: "RMB",
  domesticShipping: 6,
  domesticShippingCurrency: "RMB",
  weight: "260g",
  minimumOrderQuantity: 2,
};

test("Product Knowledge normalizes Superbuy source labels into evidence-backed fields", () => {
  const data = fixture();
  data.products.push({ id: "11111111-1111-4111-8111-111111111111", title: sourceProduct.title, category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });

  const summary = buildProductKnowledgeFromSuperbuy(data, data.products[0].id, sourceProduct);

  assert.equal(productKnowledgeValue(data, data.products[0].id, "material"), "Cotton blend");
  assert.equal(productKnowledgeValue(data, data.products[0].id, "universal_category"), "T-shirt");
  assert.equal(productKnowledgeValue(data, data.products[0].id, "supplier_shop"), "Shangrao Nanxi Clothing Co., Ltd");
  assert.equal((productKnowledgeValue(data, data.products[0].id, "variant_options") as { rows: unknown[] }).rows.length, 2);
  assert.deepEqual(productKnowledgeValue(data, data.products[0].id, "price"), { minimum: 18, maximum: 18, currency: "RMB", tiers: [], sourceOfTruth: "supplier_original_currency" });
  assert.deepEqual(productKnowledgeValue(data, data.products[0].id, "domestic_shipping"), { amount: 6, currency: "RMB" });
  assert.equal(productKnowledgeValue(data, data.products[0].id, "minimum_order_quantity"), 2);
  assert.ok(summary.evidence.some((entry) => entry.sourceLabel === "Main Fabric Composition" && entry.normalizedFieldKey === "fabric_composition"));
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
  assert.equal(data.productKnowledgeMemory?.[0]?.usageCount, 1);
  assert.equal(data.productKnowledgeMemory?.[0]?.status, "active");
});

test("Product Knowledge preserves Chinese labels, supplier cleanup, variant groups, and stock evidence", () => {
  const data = fixture();
  const productId = "44444444-4444-4444-8444-444444444444";
  data.products.push({ id: productId, title: "Shopping agent product Y2K shoulder bag", category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });

  buildProductKnowledgeFromSuperbuy(data, productId, {
    ...sourceProduct,
    title: "Y2K crescent shoulder bag",
    category: "Item",
    rawAttributes: {
      "产品类别": "Bags > Shoulder Bags",
      "材质": "PU leather",
      "里料": "Polyester",
      "起订量": 3,
      "库存": 88,
    },
    storeName: "SHOPVisit StoreGuangzhou Chenyi E-commerce Co., Ltd3.7OverallDescription3.0Service4.5Logistics3.",
    variantOptions: {
      groups: [
        { label: "颜色", translatedLabel: "Color", options: [{ id: "black", label: "Black", price: 28, stock: 30 }, { id: "white", label: "White", price: 29, stock: 58 }] },
      ],
      combinations: [{ optionIds: ["black"], labels: ["Black"], price: 28, stock: 30, available: true }],
    },
    variants: [
      { id: "black", name: "Black", options: ["Black"], price: 28, stock: 30 },
      { id: "white", name: "White", options: ["White"], price: 29, stock: 58 },
    ],
    stock: 88,
    minimumOrderQuantity: 3,
  });

  assert.equal(productKnowledgeValue(data, productId, "supplier_shop"), "Guangzhou Chenyi E-commerce Co., Ltd");
  assert.equal(productKnowledgeValue(data, productId, "material"), "PU leather");
  assert.equal(productKnowledgeValue(data, productId, "minimum_order_quantity"), 3);
  assert.equal(productKnowledgeValue(data, productId, "stock"), 88);
  const variants = productKnowledgeValue(data, productId, "variant_options") as { groups: { label: string; options: { stock?: number }[] }[]; combinations: { labels: string[]; stock?: number }[] };
  assert.equal(variants.groups[0].label, "颜色");
  assert.equal(variants.groups[0].options[0].stock, 30);
  assert.equal(variants.combinations[0].labels[0], "Black");
});

test("Product Knowledge flags conflicting material evidence and requires review", () => {
  const data = fixture();
  const productId = "55555555-5555-4555-8555-555555555555";
  data.products.push({ id: productId, title: "Conflicting bag", category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });

  buildProductKnowledgeFromSuperbuy(data, productId, {
    ...sourceProduct,
    rawAttributes: {
      "Product Category": "Bag",
      "Material": "Leather",
      "Main Fabric Composition": "PU",
    },
  });

  const material = productKnowledgeSummary(data, productId).fields.find((entry) => entry.fieldKey === "material");
  assert.equal(material?.value, "Leather");
  assert.ok(material?.conflictingEvidenceIds?.length);
  assert.equal(material?.reviewRequired, true);
  assert.ok(material?.confidence && material.confidence < 0.83);
});

test("Product Knowledge rejection blocks the same generated value until corrected or reset", () => {
  const data = fixture();
  const productId = "66666666-6666-4666-8666-666666666666";
  data.products.push({ id: productId, title: sourceProduct.title, category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, productId, sourceProduct);

  applyProductKnowledgeDecision(data, { productId, fieldKey: "material", decision: "rejected", actor: "test" });
  buildProductKnowledgeFromSuperbuy(data, productId, sourceProduct);

  const field = productKnowledgeSummary(data, productId).fields.find((entry) => entry.fieldKey === "material");
  assert.equal(field?.status, "rejected");
  assert.equal(productKnowledgeValue(data, productId, "material"), undefined);
});

test("Product Knowledge memory weakens and suspends after repeated rejection", () => {
  const data = fixture();
  const productId = "77777777-7777-4777-8777-777777777777";
  data.products.push({ id: productId, title: sourceProduct.title, category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, productId, sourceProduct);
  applyProductKnowledgeDecision(data, { productId, fieldKey: "material", decision: "corrected", value: "100% cotton", actor: "test" });
  const memory = data.productKnowledgeMemory?.find((entry) => entry.memoryType === "material_mapping");
  assert.ok(memory);

  const secondProductId = "88888888-8888-4888-8888-888888888888";
  data.products.push({ id: secondProductId, title: "Second tee", category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, secondProductId, sourceProduct);
  applyProductKnowledgeDecision(data, { productId: secondProductId, fieldKey: "material", decision: "rejected", actor: "test" });

  const thirdProductId = "99999999-9999-4999-8999-999999999999";
  data.products.push({ id: thirdProductId, title: "Third tee", category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, thirdProductId, sourceProduct);
  applyProductKnowledgeDecision(data, { productId: thirdProductId, fieldKey: "material", decision: "rejected", actor: "test" });

  assert.equal(memory.rejectedApplications, 2);
  assert.equal(memory.status, "suspended");
});

test("Product Knowledge memory is isolated by OperatingData workspace", () => {
  const first = fixture();
  const second = fixture();
  const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  first.products.push({ id: productId, title: sourceProduct.title, category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(first, productId, sourceProduct);
  applyProductKnowledgeDecision(first, { productId, fieldKey: "material", decision: "corrected", value: "100% cotton", actor: "test" });

  const otherProductId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  second.products.push({ id: otherProductId, title: "Other workspace tee", category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(second, otherProductId, sourceProduct);

  assert.equal(productKnowledgeValue(second, otherProductId, "material"), "Cotton blend");
  assert.equal(second.productKnowledgeMemory?.length, 0);
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
