import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { buildProductPipeline, createProductReviewSession, productPipelineQueueItemId, recordProductPipelineBulkOperation, syncProductPipelineState } from "../lib/product-pipeline";
import type { ProductExperience } from "../lib/product-experience";

const time = "2026-07-28T00:00:00.000Z";

function data(): OperatingData {
  return { version: 1, mode: "local", updatedAt: time, products: [], variants: [], locations: [], balances: [], stockMovements: [], suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [], channelListingDrafts: [], marketplacePublishTasks: [] };
}

function experience(overrides: Partial<ProductExperience> = {}): ProductExperience {
  const product = { id: "11111111-1111-4111-8111-111111111111", title: "Pipeline Tee", category: "T-shirt", tags: [], image: "/tee.jpg", images: ["/tee.jpg"], status: "active" as const, createdAt: time, updatedAt: time };
  const variant = { id: "22222222-2222-4222-8222-222222222222", productId: product.id, sku: "PIPE-TEE-001", title: "Black / L", condition: "New", landedUnitCost: 10, defaultSalePrice: 50, weightOz: 8, reorderPoint: 2, reorderQuantity: 6, active: true };
  const base = {
    product,
    variant,
    href: `/catalog/${variant.id}`,
    supplierName: "Pipeline Supplier",
    supplierDetail: "1688",
    readiness: { status: "ready" as const, score: 92, missing: [], nextAction: "Generate marketplace drafts", dimensions: [{ key: "photos" as const, label: "Photos", ready: true, detail: "Ready" }] },
    inventory: { onHand: 6, reserved: 0, available: 6, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0, value: 60 },
    finance: { cost: 10, sellingPrice: 50, revenue: 0, profit: 0, margin: 80, roi: 400, averageSellingPrice: 0, cashInvested: 60, cashReturned: 0, projectedRevenue: 300 },
    analytics: { unitsSold: 0, returns: 0, sellThrough: 0, bestMarketplace: "Depop", velocityLabel: "No sales velocity yet" },
    purchasing: { leadTime: "10 days", moq: "2", reorderPoint: 2, recommendedReorderQuantity: 6, openPurchaseOrders: 0, purchasingHistory: 0 },
    marketplaces: [
      { marketplace: "Depop" as const, status: "pending" as const, detail: "Draft not generated" },
      { marketplace: "eBay" as const, status: "pending" as const, detail: "Draft not generated" },
      { marketplace: "Etsy" as const, status: "pending" as const, detail: "Draft not generated" },
      { marketplace: "Mercari" as const, status: "pending" as const, detail: "Draft not generated" },
      { marketplace: "Poshmark" as const, status: "pending" as const, detail: "Draft not generated" },
    ],
    ai: { recommendation: "Generate drafts", confidence: 0.86, evidence: "Ready", nextAction: "Generate drafts" },
    intelligence: { faustScore: { score: 88, label: "Ready", explanation: "", components: [] }, health: [], dna: [], relationships: [], recommendation: { situation: "Product is close to publishing.", reasoning: "Readiness is high.", expectedOutcome: "Drafts can be created.", confidence: 0.86, confidenceBasis: [] } },
    productKnowledge: {
      fields: [],
      evidence: [],
      decisions: [],
      completeness: [],
      reviewPlan: { mustReview: [], recommendedReview: [], alreadyUnderstood: [], safeBulkApproval: [] },
      overview: { understoodPercent: 92, evidenceCount: 4, mustReview: 0, missing: 0, conflicts: 0, confirmedEvidence: 3, recommendedPrimaryAction: "Generate drafts" },
      observability: { evidenceRecordsCreated: 0, decisionsMade: 0, generatedFields: 0, confirmedFields: 0, correctedFields: 0, rejectedFields: 0, conflicts: 0, memoryApplications: 0, memoryOverrides: 0, suspendedMemories: 0, averageCompleteness: 0, averageReviewCount: 0, averageTimeToReadyMinutes: 0 },
    },
    visualIntelligence: {
      observations: [],
      qualities: [],
      recommendation: undefined,
      categoryCandidates: [],
      coverImageId: undefined,
      conflict: undefined,
      observability: { imageObservationsCreated: 1, categoryConflictsDetected: 0, coverRecommendationsAccepted: 0, coverRecommendationsOverridden: 0, imageDerivedFieldsApproved: 0, imageDerivedFieldsCorrected: 0, falsePositiveImageSuggestions: 0 },
    },
    timeline: [],
  } satisfies ProductExperience;
  return { ...base, ...overrides } as ProductExperience;
}

test("product pipeline creates one lifecycle stage and next action for every product", () => {
  const operating = data();
  const pipeline = buildProductPipeline(operating, [experience()]);

  assert.equal(pipeline.products.length, 1);
  assert.equal(pipeline.products[0].stage, "ready");
  assert.equal(pipeline.products[0].nextAction, "Generate drafts");
  assert.ok(pipeline.workItems.some((item) => item.kind === "generate_drafts"));
  assert.equal(pipeline.summary.stageCounts.ready, 1);
});

test("product pipeline prioritizes review blockers above safe bulk approvals", () => {
  const operating = data();
  const item = experience({
    readiness: { status: "incomplete", score: 64, missing: ["marketplace category"], nextAction: "Review category", dimensions: [] },
    productKnowledge: {
      ...experience().productKnowledge,
      reviewPlan: { mustReview: [{ id: "field-1", productId: "11111111-1111-4111-8111-111111111111", fieldKey: "universal_category", value: "Blouse", confidence: 0.55, status: "generated", source: "evidence", explanation: "Ambiguous supplier category.", supportingEvidenceIds: [], reviewRequired: true, revision: 1, updatedAt: time }], recommendedReview: [], alreadyUnderstood: [], safeBulkApproval: [{ id: "field-2", productId: "11111111-1111-4111-8111-111111111111", fieldKey: "material", value: "Cotton", confidence: 0.9, status: "generated", source: "evidence", explanation: "Supplier confirmed.", supportingEvidenceIds: [], revision: 1, updatedAt: time }] },
      overview: { understoodPercent: 64, evidenceCount: 3, mustReview: 1, missing: 0, conflicts: 1, confirmedEvidence: 2, recommendedPrimaryAction: "Review category" },
    },
    visualIntelligence: { ...experience().visualIntelligence, conflict: { supplierValue: "Blouse", imageCandidate: "T-shirt", message: "Supplier category says blouse. Image structure appears to be a T-shirt. Review required." }, observability: { ...experience().visualIntelligence.observability, categoryConflictsDetected: 1 } },
  });
  const pipeline = buildProductPipeline(operating, [item]);

  assert.equal(pipeline.products[0].stage, "needs_review");
  assert.equal(pipeline.recommended?.kind, "review_category");
  assert.equal(pipeline.recommended?.blocksDownstream, true);
  assert.ok(pipeline.workItems.some((work) => work.kind === "review_material" && work.action.type === "approve_knowledge"));
});

test("product pipeline moves drafted products into ready-to-publish and publish actions", () => {
  const operating = data();
  const product = experience();
  operating.channelListingDrafts = ["Depop", "eBay", "Etsy", "Mercari", "Poshmark"].map((marketplace, index) => ({ id: `33333333-3333-4333-8333-33333333333${index}`, listingId: `44444444-4444-4444-8444-44444444444${index}`, variantId: product.variant.id, physicalSku: product.variant.sku, marketplace: marketplace as "Depop", title: `${marketplace} Pipeline Tee`, price: 50, quantity: 2, status: "validated" as const, syncState: "clean" as const, publishMode: "adapter" as const, imageUrls: ["/tee.jpg"], description: "A complete marketplace-ready product description for pipeline testing.", category: "T-shirt", attributes: {}, validationErrors: [], createdAt: time, updatedAt: time }));

  const pipeline = buildProductPipeline(operating, [product]);

  assert.equal(pipeline.products[0].stage, "ready_to_publish");
  assert.ok(pipeline.workItems.some((item) => item.kind === "publish_ready" && item.action.type === "publish_product"));
});

test("product pipeline reports session scope, effort, and operational progress", () => {
  const operating = data();
  const ready = experience();
  const sold = experience({
    product: { ...experience().product, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Sold Tee" },
    variant: { ...experience().variant, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", sku: "SOLD-TEE-001" },
    analytics: { ...experience().analytics, unitsSold: 4 },
  });

  const pipeline = buildProductPipeline(operating, [ready, sold], new Date(time));

  assert.equal(pipeline.summary.today.imported, 2);
  assert.equal(pipeline.summary.today.sold, 1);
  assert.ok(pipeline.summary.session.productCount >= 1);
  assert.ok(pipeline.summary.session.estimatedMinutes >= 1);
});

test("product pipeline persists generated stage, queue, and history snapshots", () => {
  const operating = data();
  const pipeline = buildProductPipeline(operating, [experience()]);

  syncProductPipelineState(operating, pipeline, time);

  assert.equal(operating.productPipelineStages?.length, 1);
  assert.equal(operating.productPipelineStages?.[0].stage, "ready");
  assert.equal(operating.productPipelineQueueItems?.length, 1);
  assert.equal(operating.productPipelineQueueItems?.[0].id, productPipelineQueueItemId(pipeline.workItems[0].id));
  assert.equal(operating.productPipelineQueueItems?.[0].status, "open");
  assert.equal(operating.productPipelineQueueHistory?.[0].action, "generated");
  assert.equal(operating.productPipelineStageHistory?.[0].toStage, "ready");
});

test("product pipeline resolves queue tasks when deterministic completion conditions clear", () => {
  const operating = data();
  const product = experience();
  const first = buildProductPipeline(operating, [product]);
  syncProductPipelineState(operating, first, time);

  const afterDrafts = buildProductPipeline({
    ...operating,
    channelListingDrafts: ["Depop", "eBay", "Etsy", "Mercari", "Poshmark"].map((marketplace, index) => ({ id: `55555555-5555-4555-8555-55555555555${index}`, listingId: `66666666-6666-4666-8666-66666666666${index}`, variantId: product.variant.id, physicalSku: product.variant.sku, marketplace: marketplace as "Depop", title: `${marketplace} Pipeline Tee`, price: 50, quantity: 2, status: "validated" as const, syncState: "clean" as const, publishMode: "adapter" as const, imageUrls: ["/tee.jpg"], description: "A complete marketplace-ready product description for pipeline testing.", category: "T-shirt", attributes: {}, validationErrors: [], createdAt: time, updatedAt: time })),
  }, [product]);
  syncProductPipelineState(operating, afterDrafts, "2026-07-28T00:05:00.000Z");

  assert.ok(operating.productPipelineQueueItems?.some((item) => item.status === "resolved" && item.type === "generate_drafts"));
  assert.ok(operating.productPipelineTaskResolutions?.some((item) => item.resolution === "resolved"));
  assert.ok(operating.productPipelineQueueHistory?.some((item) => item.action === "resolved"));
});

test("product pipeline prevents impossible backward transitions from published to imported", () => {
  const operating = data();
  const product = experience();
  operating.productPipelineStages = [{ id: "77777777-7777-4777-8777-777777777777", productId: product.product.id, variantId: product.variant.id, stage: "published", priority: 90, readinessScore: 100, sourceRevision: "prior", observedAt: time, updatedAt: time }];

  const pipeline = buildProductPipeline(operating, [product]);

  assert.equal(pipeline.products[0].stage, "published");
});

test("product pipeline persists focused review sessions and safe bulk operations", () => {
  const operating = data();
  const item = experience({
    readiness: { status: "incomplete", score: 68, missing: ["material"], nextAction: "Review material", dimensions: [] },
    productKnowledge: {
      ...experience().productKnowledge,
      reviewPlan: { mustReview: [], recommendedReview: [], alreadyUnderstood: [], safeBulkApproval: [{ id: "field-3", productId: "11111111-1111-4111-8111-111111111111", fieldKey: "material", value: "Cotton", confidence: 0.94, status: "generated", source: "evidence", explanation: "Supplier confirmed.", supportingEvidenceIds: [], revision: 1, updatedAt: time }] },
    },
  });
  const pipeline = buildProductPipeline(operating, [item]);
  syncProductPipelineState(operating, pipeline, time);

  const session = createProductReviewSession(operating, pipeline, time);
  const operation = recordProductPipelineBulkOperation(operating, {
    operationType: "approve_materials",
    queueItemIds: pipeline.summary.session.items.map((work) => productPipelineQueueItemId(work.id)),
    productIds: [item.product.id],
    resultSummary: "Approve high-confidence materials",
  }, time);

  assert.equal(session.status, "active");
  assert.ok(session.queueItemIds.every((id) => /^[0-9a-f-]{36}$/.test(id)));
  assert.equal(operation.operationType, "approve_materials");
  assert.equal(operation.status, "completed");
  assert.ok(operating.productPipelineReviewSessions?.some((entry) => entry.id === session.id));
  assert.ok(operating.productPipelineBulkOperations?.some((entry) => entry.id === operation.id));
});
