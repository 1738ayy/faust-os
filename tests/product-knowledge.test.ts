import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import type { SuperbuyProduct } from "../types/superbuy-product";
import { importExtensionProduct } from "../lib/browser-extension";
import { productKnowledgeBenchmarkFixtures, evaluateProductKnowledgeBenchmark } from "../lib/product-knowledge-benchmark";
import { applyProductKnowledgeDecision, approveHighConfidenceProductKnowledgeFacts, buildProductKnowledgeFromSuperbuy, estimateProductKnowledgeTimeToReady, productKnowledgeCorrectionImpactPreview, productKnowledgeFieldHistory, productKnowledgeObservability, productKnowledgeSummary, productKnowledgeValue } from "../lib/product-knowledge";
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

test("Product Knowledge benchmark dataset covers representative supplier product shapes", () => {
  assert.equal(productKnowledgeBenchmarkFixtures.length, 30);
  const categories = new Set(productKnowledgeBenchmarkFixtures.map((entry) => entry.category));
  for (const category of ["T-shirts", "Tops", "Jeans", "Shorts", "Jewelry", "Necklaces", "Bracelets", "Belts", "Handbags", "Accessories"]) {
    assert.ok(categories.has(category), `${category} benchmark fixture exists`);
  }
  assert.ok(productKnowledgeBenchmarkFixtures.some((entry) => entry.notes.includes("mixed Chinese labels")));
  assert.ok(productKnowledgeBenchmarkFixtures.some((entry) => entry.notes.includes("conflicting material signals")));
  assert.ok(productKnowledgeBenchmarkFixtures.some((entry) => entry.notes.includes("tiered RMB prices")));
  assert.ok(productKnowledgeBenchmarkFixtures.some((entry) => entry.notes.includes("incomplete metadata")));
});

test("Product Knowledge benchmark measures extraction quality and unknown-value restraint", () => {
  const result = evaluateProductKnowledgeBenchmark();

  assert.equal(result.fixtureCount, 30);
  assert.ok(result.fieldResultCount >= 300);
  assert.ok(result.exactOrAcceptableAccuracy >= 78, `accuracy ${result.exactOrAcceptableAccuracy}`);
  assert.ok(result.missingFieldPrecision >= 60, `unknown precision ${result.missingFieldPrecision}`);
  assert.ok(result.falsePositiveRate <= 40, `false positive rate ${result.falsePositiveRate}`);
  assert.ok(result.variantPreservationAccuracy >= 90, `variant preservation ${result.variantPreservationAccuracy}`);
  assert.ok(result.supplierCleanupAccuracy >= 80, `supplier cleanup ${result.supplierCleanupAccuracy}`);
  assert.ok(result.priceExtractionAccuracy >= 95, `price extraction ${result.priceExtractionAccuracy}`);
  assert.ok(result.stockAccuracy >= 90, `stock extraction ${result.stockAccuracy}`);
});

test("Product Knowledge confidence calibration is directionally sane", () => {
  const result = evaluateProductKnowledgeBenchmark();
  const high = result.confidenceBuckets.find((bucket) => bucket.label === "90-100%");
  const mid = result.confidenceBuckets.find((bucket) => bucket.label === "75-89%");
  const low = result.confidenceBuckets.find((bucket) => bucket.label === "50-74%");

  assert.ok(high?.count);
  assert.ok(mid?.count);
  assert.ok(low?.count);
  assert.ok(high.correctness >= mid.correctness, `high ${high.correctness} mid ${mid.correctness}`);
  if (low.count >= 10) assert.ok(mid.correctness >= low.correctness, `mid ${mid.correctness} low ${low.correctness}`);
  else assert.ok(low.correctness >= 90, `small low-confidence sample remains measured separately: ${low.correctness}`);
});

test("Product Knowledge summary prioritizes meaningful review and safe bulk approval", () => {
  const data = fixture();
  const productId = "abababab-abab-4bab-8bab-abababababab";
  data.products.push({ id: productId, title: "Review tee", category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, productId, {
    ...sourceProduct,
    rawAttributes: {
      "Product Category": "T-shirt",
      "Material": "Leather",
      "Main Fabric Composition": "Cotton",
    },
  });

  const summary = productKnowledgeSummary(data, productId);
  assert.ok(summary.overview.understoodPercent > 50);
  assert.ok(summary.reviewPlan.mustReview.some((field) => field.fieldKey === "material"));
  assert.ok(summary.reviewPlan.safeBulkApproval.every((field) => field.confidence >= 0.82 && !field.reviewRequired));

  const approval = approveHighConfidenceProductKnowledgeFacts(data, productId);
  assert.ok(approval.approvedCount > 0);
  assert.ok(!approval.approvedFieldKeys.includes("material"));
  assert.ok(data.productKnowledgeDecisions?.some((decision) => decision.reason === "Bulk approved high-confidence supplier evidence."));
});

test("Product Knowledge exposes decision history, impact preview, observability, and time-to-ready metrics", () => {
  const data = fixture();
  const productId = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
  data.products.push({ id: productId, title: sourceProduct.title, category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, productId, sourceProduct);
  applyProductKnowledgeDecision(data, { productId, fieldKey: "universal_category", decision: "corrected", value: "Tops > T-Shirts", reason: "Supplier category was too broad.", actor: "test" });

  const history = productKnowledgeFieldHistory(data, productId, "universal_category");
  assert.ok(history.some((entry) => entry.type === "Imported"));
  assert.ok(history.some((entry) => entry.type === "Corrected"));

  const impact = productKnowledgeCorrectionImpactPreview(data, productId, "universal_category", "Apparel > Tops > T-Shirts");
  assert.ok(impact.updates.includes("marketplace draft categories"));
  assert.ok(impact.protectedItems.includes("manually edited marketplace fields"));
  assert.ok(impact.estimatedMarketplaceReadinessLift > 0);

  const observability = productKnowledgeObservability(data, productId);
  assert.ok(observability.evidenceRecordsCreated > 0);
  assert.ok(observability.correctedFields >= 1);
  assert.ok(observability.averageCompleteness > 0);

  const effort = estimateProductKnowledgeTimeToReady(productKnowledgeSummary(data, productId).fields);
  assert.ok(effort.manualMinutes > effort.estimatedPkeMinutes);
  assert.ok(effort.effortSavedPercent > 0);
});

test("Product Knowledge memory improves related products without leaking across scope", () => {
  const data = fixture();
  const firstProductId = "efefefef-efef-4fef-8fef-efefefefefef";
  data.products.push({ id: firstProductId, title: sourceProduct.title, category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, firstProductId, sourceProduct, "supplier-a");
  applyProductKnowledgeDecision(data, { productId: firstProductId, fieldKey: "universal_category", decision: "corrected", value: "Premium tees", actor: "test" });
  const memory = data.productKnowledgeMemory?.find((entry) => entry.memoryType === "category_mapping");
  assert.ok(memory);
  memory.scope = "supplier";
  memory.supplierId = "supplier-a";

  const relatedProductId = "fafafafa-fafa-4afa-8afa-fafafafafafa";
  data.products.push({ id: relatedProductId, title: "Related tee", category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, relatedProductId, { ...sourceProduct, title: "Related tee", superbuyUrl: "https://detail.1688.com/offer/related.html" }, "supplier-a");
  const related = productKnowledgeSummary(data, relatedProductId).fields.find((entry) => entry.fieldKey === "universal_category");
  assert.equal(related?.value, "Premium tees");
  assert.equal(related?.source, "memory");
  assert.match(related?.explanation || "", /Confidence increased/);

  const unrelatedProductId = "12121212-1212-4212-8212-121212121212";
  data.products.push({ id: unrelatedProductId, title: "Unrelated tee", category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
  buildProductKnowledgeFromSuperbuy(data, unrelatedProductId, { ...sourceProduct, title: "Unrelated tee", superbuyUrl: "https://detail.1688.com/offer/unrelated.html" }, "supplier-b");
  const unrelated = productKnowledgeSummary(data, unrelatedProductId).fields.find((entry) => entry.fieldKey === "universal_category");
  assert.notEqual(unrelated?.value, "Premium tees");
});
