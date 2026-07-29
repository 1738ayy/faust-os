import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import type { SuperbuyProduct } from "../types/superbuy-product";
import { applyProductKnowledgeDecision, buildProductKnowledgeFromSuperbuy } from "../lib/product-knowledge";
import { adapterHealthDashboard, automationRuleEffectiveness, confidenceCalibration, ensureIntelligenceObservabilityCollections, evidenceExplorer, exportDiagnosticsBundle, intelligenceStudioSummary, learningExplorer, pipelineAnalytics, productDecisionTimeline, replayProductDecisions, repositoryParityDiagnostics, runBenchmarkStudio } from "../lib/intelligence-observability";

const time = "2026-07-28T00:00:00.000Z";
const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const variantId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function fixture(): OperatingData {
  const data: OperatingData = {
    version: 1,
    mode: "local",
    updatedAt: time,
    products: [{ id: productId, title: "Observability test tee", category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time, images: ["https://img.example.test/tee-front.jpg"] }],
    productImages: [],
    productDigitalTwins: [],
    variants: [{ id: variantId, productId, sku: "FST-OBS-TEE-L", title: "Black / L", condition: "New", landedUnitCost: 12, defaultSalePrice: 44, reorderPoint: 2, reorderQuantity: 8, active: true }],
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
    channelListingDrafts: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", listingId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", variantId, physicalSku: "FST-OBS-TEE-L", marketplace: "Depop", title: "Observability test tee", description: "Draft generated for diagnostics.", price: 44, category: "T-Shirts", attributes: {}, imageUrls: ["https://img.example.test/tee-front.jpg"], quantity: 1, status: "validated", validationErrors: [], publishMode: "extension", syncState: "pending", createdAt: time, updatedAt: time }],
    marketplaceAccounts: [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", marketplace: "Depop", displayName: "Depop staging", status: "connected", supportsApiPublish: false, supportsExtension: true, createdAt: time }],
    marketplaceConnectorDiagnostics: [{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", marketplace: "Depop", operation: "publish", status: "succeeded", retryable: false, message: "Dry-run publish succeeded.", suggestedResolution: "No action needed.", connectorVersion: "test", metadata: { durationMs: 1200 }, createdAt: time }],
    automationRules: [{ id: "11111111-1111-4111-8111-111111111111", name: "Ready product notification", description: "Notify when a product is ready.", enabled: true, priority: 1, version: 1, localOverrides: [], trigger: { type: "analytics.saved_report_completed", samplePayload: { productId } }, conditionMode: "AND", conditions: [], actions: [], approvalRequired: false, dryRun: false, runCount: 1, failureCount: 0, createdAt: time }],
    automationRuns: [{ id: "22222222-2222-4222-8222-222222222222", ruleId: "11111111-1111-4111-8111-111111111111", triggerType: "analytics.saved_report_completed", status: "succeeded", idempotencyKey: "obs-run", eventPayload: { productId }, conditionResults: [], stepIds: [], durationMs: 300, queueDelayMs: 20, createdAt: time }],
    automationSteps: [],
    automationApprovals: [],
    automationRetries: [],
    automationMetricSnapshots: [{ id: "33333333-3333-4333-8333-333333333333", totalRuns: 1, successRate: 100, failureRate: 0, dryRunCount: 0, approvalCount: 0, timeSavedMinutes: 8, manualInterventionsAvoided: 1, disabledRules: 0, averageDurationMs: 300, createdAt: time }],
    productPipelineStageHistory: [{ id: "44444444-4444-4444-8444-444444444444", productId, variantId, fromStage: "imported", toStage: "needs_review", reason: "Imported for review.", sourceRevision: "test", createdAt: time }],
    productPipelineReviewSessions: [{ id: "55555555-5555-4555-8555-555555555555", status: "completed", productIds: [productId], queueItemIds: [], estimatedMinutes: 3, goal: "Ready for Publishing", startedAt: time, completedAt: "2026-07-28T00:04:00.000Z", createdAt: time, updatedAt: time }],
  };
  ensureIntelligenceObservabilityCollections(data);
  const source: SuperbuyProduct = {
    source: "1688",
    importedAt: time,
    title: "Observability test tee",
    superbuyUrl: "https://detail.1688.com/offer/obs.html",
    storeName: "North Star Test Supplier",
    category: "Item",
    rawAttributes: { "Product Category": "T-shirt", "Main Fabric Composition": "Cotton" },
    images: ["https://img.example.test/tee-front.jpg"],
    variants: [{ id: "black-l", name: "Black / L", options: ["Black", "L"], price: 18, stock: 7 }],
    price: 18,
  };
  buildProductKnowledgeFromSuperbuy(data, productId, source);
  applyProductKnowledgeDecision(data, { productId, fieldKey: "material", decision: "corrected", value: "100% cotton", actor: "test" });
  return data;
}

test("intelligence observability builds traceable Product decisions and evidence", () => {
  const data = fixture();
  const timeline = productDecisionTimeline(data, productId);
  assert.ok(timeline.some((event) => event.eventType === "imported"));
  assert.ok(timeline.some((event) => event.eventType === "evidence_parsed"));
  assert.ok(timeline.some((event) => event.eventType === "field_corrected"));
  assert.ok(timeline.some((event) => event.eventType === "draft_generated"));
  assert.ok(timeline.some((event) => event.eventType === "automation_executed"));
  const evidence = evidenceExplorer(data, productId);
  assert.ok(evidence.some((field) => field.fieldKey === "material" && field.finalCanonicalValue === "100% cotton"));
  assert.ok(evidence.some((field) => field.userDecisions.length > 0));
});

test("intelligence studio persists benchmark, replay, parity, and diagnostics history", () => {
  const data = fixture();
  const benchmark = runBenchmarkStudio(data, { versionLabel: "E.26", idempotencyKey: "66666666-6666-4666-8666-666666666666" });
  assert.equal(data.intelligenceBenchmarkRuns?.[0]?.id, benchmark.id);
  assert.ok(benchmark.fieldResultCount > 0);
  const replay = replayProductDecisions(data, productId, { versionLabel: "E.26", idempotencyKey: "77777777-7777-4777-8777-777777777777" });
  assert.equal(replay.productId, productId);
  assert.ok(replay.currentFieldCount > 0);
  const parity = repositoryParityDiagnostics(data, { idempotencyKey: "88888888-8888-4888-8888-888888888888" });
  assert.equal(parity.ready, true);
  assert.equal(parity.schemaVersion, "035_intelligence_observability_studio.sql");
  const bundle = exportDiagnosticsBundle(data, { productId, idempotencyKey: "99999999-9999-4999-8999-999999999999" });
  assert.equal(bundle.productId, productId);
  assert.ok(bundle.sections.some((section) => section.name === "decisionTimeline" && section.recordCount > 0));
});

test("intelligence dashboards report calibration, learning, rules, adapters, pipeline, and summary", () => {
  const data = fixture();
  runBenchmarkStudio(data, { versionLabel: "baseline" });
  const calibration = confidenceCalibration(data);
  assert.ok(calibration.confidenceBuckets.length > 0);
  assert.ok(calibration.averageConfidence > 0);
  const learning = learningExplorer(data);
  assert.ok(learning.total > 0);
  assert.ok(learning.influencedProducts.length > 0);
  const rules = automationRuleEffectiveness(data);
  assert.equal(rules[0].successRate, 100);
  const adapters = adapterHealthDashboard(data);
  assert.equal(adapters[0].publishSuccessRate, 100);
  const pipeline = pipelineAnalytics(data);
  assert.equal(pipeline.productsPerSession, 1);
  assert.equal(pipeline.automationSavings, 8);
  const summary = intelligenceStudioSummary(data);
  assert.equal(summary.productId, productId);
  assert.ok(summary.decisionTimeline.length > 0);
});
