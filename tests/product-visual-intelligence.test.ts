import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData, Product } from "../domain/business";
import { createFiveChannelDrafts, inspectProductMarketplaceDraft } from "../lib/listings-core";
import { applyProductKnowledgeDecision, buildProductKnowledgeFromSuperbuy, productKnowledgeValue } from "../lib/product-knowledge";
import { evaluateProductKnowledgeBenchmark } from "../lib/product-knowledge-benchmark";
import { setProductImages } from "../lib/product-images";
import { getProductReadiness } from "../lib/product-readiness";
import { analyzeProductImages, applyImageReviewDecision, categoryCandidatesForProduct, diagnoseCategoryBenchmarkFailures, visualIntelligenceSummary } from "../lib/product-visual-intelligence";
import type { SuperbuyProduct } from "../types/superbuy-product";

const time = "2026-07-28T00:00:00.000Z";
const uuid = (seed: string) => `${seed.padEnd(8, seed[0] || "a").slice(0, 8)}-${seed.padEnd(4, seed[0] || "a").slice(0, 4)}-4${seed.padEnd(3, seed[0] || "a").slice(0, 3)}-8${seed.padEnd(3, seed[0] || "a").slice(0, 3)}-${seed.padEnd(12, seed[0] || "a").slice(0, 12)}`;

function fixture(): OperatingData {
  return { version: 1, mode: "local", updatedAt: time, products: [], productImages: [], productDigitalTwins: [], productKnowledgeEvidence: [], productKnowledgeFields: [], productKnowledgeDecisions: [], productKnowledgeMemory: [], productKnowledgeConfidenceHistory: [], productImageObservations: [], productImageQuality: [], productCoverRecommendations: [], productImageReviewDecisions: [], variants: [], locations: [], balances: [], stockMovements: [], suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [], purchaseBatches: [], landedCostComponents: [], marketplaceAccounts: [], listingTemplates: [], channelListingDrafts: [], listingSyncJobs: [], listingReviewItems: [], physicalSkuMappings: [], outboxEvents: [], durableJobs: [], deadLetters: [], channelSyncStates: [], inventoryRiskLocks: [] };
}

const source: SuperbuyProduct = {
  source: "1688",
  importedAt: time,
  title: "Black graphic T-shirt with clear front print",
  superbuyUrl: "https://detail.1688.com/offer/visual-1.html",
  original1688Url: "https://detail.1688.com/offer/visual-1.html",
  storeName: "Shangrao Nanxi Clothing Co., Ltd",
  category: "Blouse",
  rawAttributes: { "Product Category": "Blouse", "Main Fabric Composition": "Cotton blend" },
  images: [],
  variants: [{ id: "black-l", name: "Black / L", options: ["Black", "L"], stock: 8 }],
  variantOptions: { colors: ["Black"], sizes: ["L"] },
  price: 18,
  weight: "240g",
};

function productWithImages(data: OperatingData) {
  const product: Product = { id: uuid("visual"), title: source.title, category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time };
  data.products.push(product);
  data.variants.push({ id: uuid("variant"), productId: product.id, sku: "VISUAL-TEE-001", title: "Black / L", condition: "New", landedUnitCost: 10, defaultSalePrice: 42, reorderPoint: 2, reorderQuantity: 6, active: true });
  setProductImages(data, product, [
    "https://cdn.example.test/black-tshirt-front-clean.jpg",
    "https://cdn.example.test/black-tshirt-front-clean-thumb.jpg",
    "https://cdn.example.test/black-tshirt-size-chart.jpg",
    "https://cdn.example.test/black-tshirt-detail-label.jpg",
    "https://cdn.example.test/black-tshirt-dark-busy-model.jpg",
  ], { now: time, id: () => crypto.randomUUID(), sourceType: "supplier" });
  buildProductKnowledgeFromSuperbuy(data, product.id, source);
  return { product, variantId: data.variants[0].id };
}

test("visual intelligence stores image observations and separate quality dimensions", () => {
  const data = fixture();
  const { product } = productWithImages(data);

  const result = analyzeProductImages(data, product.id);

  assert.ok(result.observations.some((entry) => entry.observationType === "dominant_color" && entry.value === "Black"));
  assert.ok(result.observations.some((entry) => entry.observationType === "logo_or_text_presence"));
  assert.ok(result.quality.every((entry) => typeof entry.sharpness === "number" && typeof entry.backgroundDistraction === "number"));
  assert.ok(result.quality.some((entry) => entry.role === "size_chart"));
  assert.ok(result.quality.some((entry) => entry.role === "detail"));
});

test("visual intelligence recommends and persists an overridable cover", () => {
  const data = fixture();
  const { product } = productWithImages(data);
  analyzeProductImages(data, product.id);
  const recommended = data.productCoverRecommendations?.[0];
  assert.ok(recommended);
  assert.match(recommended.explanation, /full Product|Ranked/);

  const alternate = data.productImages?.find((entry) => entry.url.includes("detail-label"));
  assert.ok(alternate);
  applyImageReviewDecision(data, { productId: product.id, imageId: alternate.id, action: "choose_cover", reason: "User prefers label image for this product." });

  assert.equal(product.coverImageId, alternate.id);
  assert.equal(data.productCoverRecommendations?.[0].status, "overridden");
  assert.equal(data.productImageReviewDecisions?.[0].action, "choose_cover");
});

test("visual intelligence detects duplicates without deleting source images", () => {
  const data = fixture();
  const { product } = productWithImages(data);
  analyzeProductImages(data, product.id);

  const duplicateRows = data.productImageQuality?.filter((entry) => entry.duplicateSimilarity >= 95) || [];
  assert.ok(duplicateRows.length >= 2);
  assert.equal(data.productImages?.length, 5);
  assert.ok(data.productImageObservations?.some((entry) => entry.observationType === "duplicate_status"));
});

test("visual category candidates expose supplier/image conflict and never override user decisions", () => {
  const data = fixture();
  const { product } = productWithImages(data);
  analyzeProductImages(data, product.id);

  const candidates = categoryCandidatesForProduct(data, product.id);
  assert.equal(candidates[0].label, "T-shirt");
  const summary = visualIntelligenceSummary(data, product.id);
  assert.ok(summary.conflict);
  assert.equal(productKnowledgeValue(data, product.id, "universal_category"), "Tops");

  applyProductKnowledgeDecision(data, { productId: product.id, fieldKey: "universal_category", decision: "corrected", value: "Blouse", actor: "test" });
  analyzeProductImages(data, product.id);
  assert.equal(productKnowledgeValue(data, product.id, "universal_category"), "Blouse");
});

test("approved visual category flows through canonical Product Knowledge before drafts consume it", () => {
  const data = fixture();
  const { product, variantId } = productWithImages(data);
  analyzeProductImages(data, product.id);
  applyImageReviewDecision(data, { productId: product.id, action: "approve_category_candidate", fieldKey: "universal_category", value: "T-shirt", reason: "Image and title agree after review." });

  assert.equal(productKnowledgeValue(data, product.id, "universal_category"), "T-shirt");
  createFiveChannelDrafts(data, { variantId, idempotencyKey: "visual-approved-category" });
  const inspector = inspectProductMarketplaceDraft(data, { variantId, marketplace: "Depop" });
  const categorySource = inspector.mappingSources.find((entry) => entry.fieldKey === "category");
  assert.ok(categorySource);
  assert.equal(categorySource.source, "product");
});

test("visual category conflicts affect readiness without mutating canonical product truth", () => {
  const data = fixture();
  const { product, variantId } = productWithImages(data);
  analyzeProductImages(data, product.id);
  const variant = data.variants.find((entry) => entry.id === variantId);
  assert.ok(variant);

  const readiness = getProductReadiness(data, variant, product);
  const categoryDimension = readiness.dimensions.find((entry) => entry.key === "marketplace_category");
  assert.equal(categoryDimension?.ready, false);
  assert.match(categoryDimension?.detail || "", /disagree|review/i);
  assert.equal(productKnowledgeValue(data, product.id, "universal_category"), "Tops");
});

test("brand and exact material restraint remain conservative", () => {
  const data = fixture();
  const { product } = productWithImages(data);
  analyzeProductImages(data, product.id);

  assert.equal(productKnowledgeValue(data, product.id, "brand"), undefined);
  const visualMaterials = data.productImageObservations?.filter((entry) => entry.observationType === "visible_material").map((entry) => String(entry.value)) || [];
  assert.ok(visualMaterials.every((value) => /appears|visible/.test(value)));
  assert.ok(!visualMaterials.some((value) => /100%|genuine|sterling/.test(value.toLowerCase())));
});

test("category benchmark materially improves from the prior 80 percent baseline", () => {
  const result = evaluateProductKnowledgeBenchmark();
  assert.ok(result.categoryMappingAccuracy >= 90, `category mapping ${result.categoryMappingAccuracy}`);
  const diagnostics = diagnoseCategoryBenchmarkFailures(result.failures.filter((entry) => entry.fieldKey === "universal_category"));
  assert.ok(diagnostics.every((entry) => ["taxonomy gap", "ambiguous source", "incorrect mapping rule", "fixture expectation issue", "extraction failure"].includes(entry.classification)));
});
