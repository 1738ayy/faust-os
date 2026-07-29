import type { IntelligenceBenchmarkRun, IntelligenceDecisionTimelineEvent, IntelligenceDiagnosticsBundle, IntelligenceReplayRun, IntelligenceRepositoryParityCheck, OperatingData, ProductKnowledgeFieldKey } from "@/domain/business";
import { evaluateProductKnowledgeBenchmark } from "./product-knowledge-benchmark";
import { buildProductKnowledgeFromSuperbuy, productKnowledgeSummary, productKnowledgeValue } from "./product-knowledge";
import type { SuperbuyProduct } from "@/types/superbuy-product";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export type IntelligenceActionInput = { productId?: string; suite?: IntelligenceBenchmarkRun["suite"]; versionLabel?: string; idempotencyKey?: string };

export function ensureIntelligenceObservabilityCollections(data: OperatingData) {
  data.intelligenceDecisionTimeline ||= [];
  data.intelligenceBenchmarkRuns ||= [];
  data.intelligenceReplayRuns ||= [];
  data.intelligenceRepositoryParityChecks ||= [];
  data.intelligenceDiagnosticsBundles ||= [];
}

export function productDecisionTimeline(data: OperatingData, productId: string): IntelligenceDecisionTimelineEvent[] {
  ensureIntelligenceObservabilityCollections(data);
  const product = data.products.find((entry) => entry.id === productId);
  if (!product) return [];
  const generated: IntelligenceDecisionTimelineEvent[] = [
    {
      id: `timeline:${productId}:imported`,
      productId,
      eventType: "imported",
      title: "Imported",
      detail: `${product.title} entered Faust from ${product.sourceUrl ? "a source URL" : "manual/catalog data"}.`,
      evidenceIds: [],
      decisionIds: [],
      sourceRecords: [{ type: "product", id: productId, href: `/catalog/${data.variants.find((variant) => variant.productId === productId)?.id || ""}` }],
      createdAt: product.createdAt,
    },
    ...(data.productKnowledgeEvidence || []).filter((entry) => entry.productId === productId).map((entry): IntelligenceDecisionTimelineEvent => ({
      id: `timeline:${productId}:evidence:${entry.id}`,
      productId,
      eventType: "evidence_parsed",
      title: "Supplier evidence parsed",
      detail: `${entry.sourceLabel} mapped to ${entry.normalizedFieldKey || "unmapped evidence"}.`,
      evidenceIds: [entry.id],
      decisionIds: [],
      sourceRecords: [{ type: "product_knowledge_evidence", id: entry.id }],
      confidence: entry.confidence,
      createdAt: entry.capturedAt,
    })),
    ...(data.productKnowledgeFields || []).filter((entry) => entry.productId === productId).map((entry): IntelligenceDecisionTimelineEvent => ({
      id: `timeline:${productId}:field:${entry.id}`,
      productId,
      eventType: "field_generated",
      title: `${entry.fieldKey.replaceAll("_", " ")} chosen`,
      detail: entry.explanation,
      evidenceIds: entry.supportingEvidenceIds,
      decisionIds: [],
      sourceRecords: [{ type: "product_knowledge_field", id: entry.id }],
      confidence: entry.confidence,
      createdAt: entry.updatedAt,
    })),
    ...(data.productKnowledgeDecisions || []).filter((entry) => entry.productId === productId).map((entry): IntelligenceDecisionTimelineEvent => ({
      id: `timeline:${productId}:decision:${entry.id}`,
      productId,
      eventType: entry.decision === "confirmed" ? "field_confirmed" : entry.decision === "corrected" ? "field_corrected" : "field_rejected",
      title: `${entry.fieldKey.replaceAll("_", " ")} ${entry.decision}`,
      detail: entry.reason || "User decision recorded.",
      evidenceIds: [],
      decisionIds: [entry.id],
      sourceRecords: [{ type: "product_knowledge_decision", id: entry.id }],
      createdAt: entry.decidedAt,
    })),
    ...(data.channelListingDrafts || []).filter((entry) => data.variants.some((variant) => variant.id === entry.variantId && variant.productId === productId)).map((entry): IntelligenceDecisionTimelineEvent => ({
      id: `timeline:${productId}:draft:${entry.id}`,
      productId,
      variantId: entry.variantId,
      eventType: "draft_generated",
      title: `${entry.marketplace} draft generated`,
      detail: `${entry.title} is ${entry.status} with ${entry.validationErrors.length} validation issue(s).`,
      evidenceIds: [],
      decisionIds: [],
      sourceRecords: [{ type: "channel_listing_draft", id: entry.id, href: "/listings" }],
      createdAt: entry.createdAt,
    })),
    ...(data.automationRuns || []).flatMap((run) => run.eventPayload.productId === productId || run.eventPayload.variantId && data.variants.some((variant) => variant.id === run.eventPayload.variantId && variant.productId === productId) ? [{
      id: `timeline:${productId}:automation:${run.id}`,
      productId,
      variantId: String(run.eventPayload.variantId || ""),
      eventType: "automation_executed" as const,
      title: `Automation ${run.status}`,
      detail: `${run.triggerType} executed with correlation ${run.correlationId || run.id}.`,
      evidenceIds: [],
      decisionIds: [],
      sourceRecords: [{ type: "automation_run", id: run.id, href: "/automations" }],
      createdAt: run.createdAt,
    }] : []),
  ];
  const persisted = data.intelligenceDecisionTimeline!.filter((entry) => entry.productId === productId);
  return [...generated, ...persisted].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function evidenceExplorer(data: OperatingData, productId: string) {
  const summary = productKnowledgeSummary(data, productId);
  return summary.fields.map((field) => {
    const evidence = (data.productKnowledgeEvidence || []).filter((entry) => field.supportingEvidenceIds.includes(entry.id) || field.conflictingEvidenceIds?.includes(entry.id));
    const decisions = (data.productKnowledgeDecisions || []).filter((entry) => entry.productId === productId && entry.fieldKey === field.fieldKey);
    const memory = (data.productKnowledgeMemory || []).filter((entry) => String(field.value || "").toLowerCase() === entry.output.toLowerCase() || field.explanation.includes(entry.id));
    return {
      fieldKey: field.fieldKey,
      rawSupplierValues: evidence.map((entry) => ({ label: entry.sourceLabel, value: entry.rawValue, confidence: entry.confidence })),
      normalizedValue: field.value,
      visualObservations: (data.productImageObservations || []).filter((entry) => entry.productId === productId),
      memoryContributions: memory,
      confidence: field.confidence,
      explanation: field.explanation,
      userDecisions: decisions,
      finalCanonicalValue: productKnowledgeValue(data, productId, field.fieldKey),
    };
  });
}

export function learningExplorer(data: OperatingData) {
  const memories = data.productKnowledgeMemory || [];
  return {
    total: memories.length,
    strengthened: memories.filter((entry) => (entry.successfulApplications || 0) > (entry.rejectedApplications || 0)).length,
    weakened: memories.filter((entry) => (entry.rejectedApplications || 0) > 0 && entry.status !== "suspended").length,
    suspended: memories.filter((entry) => entry.status === "suspended").length,
    unused: memories.filter((entry) => entry.usageCount === 0).length,
    conflicting: memories.filter((entry) => (entry.overriddenApplications || 0) > 0 || (entry.rejectedApplications || 0) > 0),
    influencedProducts: memories.map((memory) => ({ memoryId: memory.id, pattern: memory.pattern, output: memory.output, products: (data.productKnowledgeFields || []).filter((field) => field.source === "memory" && String(field.value || "") === memory.output).map((field) => field.productId) })),
  };
}

export function runBenchmarkStudio(data: OperatingData, input: IntelligenceActionInput = {}): IntelligenceBenchmarkRun {
  ensureIntelligenceObservabilityCollections(data);
  const existing = input.idempotencyKey ? data.intelligenceBenchmarkRuns!.find((entry) => entry.id === input.idempotencyKey) : undefined;
  if (existing) return existing;
  const suite = input.suite || "product_knowledge";
  if (suite !== "product_knowledge") {
    const run: IntelligenceBenchmarkRun = { id: input.idempotencyKey || id(), suite, versionLabel: input.versionLabel || "current", fixtureCount: 0, fieldResultCount: 0, accuracy: 0, regressionCount: 0, improvementCount: 0, failedFixtures: [], confidenceBuckets: [], createdAt: now() };
    data.intelligenceBenchmarkRuns!.unshift(run);
    return run;
  }
  const result = evaluateProductKnowledgeBenchmark();
  const previous = data.intelligenceBenchmarkRuns!.find((entry) => entry.suite === suite);
  const run: IntelligenceBenchmarkRun = {
    id: input.idempotencyKey || id(),
    suite,
    versionLabel: input.versionLabel || "current",
    fixtureCount: result.fixtureCount,
    fieldResultCount: result.fieldResultCount,
    accuracy: result.exactOrAcceptableAccuracy,
    previousAccuracy: previous?.accuracy,
    improvement: previous ? Math.round((result.exactOrAcceptableAccuracy - previous.accuracy) * 10) / 10 : undefined,
    regressionCount: previous && result.exactOrAcceptableAccuracy < previous.accuracy ? result.failures.length : 0,
    improvementCount: previous && result.exactOrAcceptableAccuracy > previous.accuracy ? Math.max(1, result.fieldResultCount - result.failures.length) : 0,
    failedFixtures: result.failures.slice(0, 25).map((entry) => ({ fixtureId: entry.fixtureId, fieldKey: entry.fieldKey, expected: JSON.stringify(entry.expected), actual: JSON.stringify(entry.actual), confidence: entry.confidence })),
    confidenceBuckets: result.confidenceBuckets.map((bucket) => ({ label: bucket.label, count: bucket.count, correctness: bucket.correctness })),
    createdAt: now(),
  };
  data.intelligenceBenchmarkRuns!.unshift(run);
  return run;
}

export function confidenceCalibration(data: OperatingData) {
  const benchmark = data.intelligenceBenchmarkRuns?.[0];
  const corrections = data.productKnowledgeDecisions || [];
  const confidenceBuckets = benchmark?.confidenceBuckets || [
    { label: "0-49%", count: 0, correctness: 0 },
    { label: "50-74%", count: 0, correctness: 0 },
    { label: "75-89%", count: 0, correctness: 0 },
    { label: "90-100%", count: 0, correctness: 0 },
  ];
  return {
    averageConfidence: average((data.productKnowledgeFields || []).map((entry) => entry.confidence)),
    confidenceBuckets,
    overconfidence: confidenceBuckets.filter((bucket) => bucket.count > 0 && bucket.correctness < Number(bucket.label.split("-")[0])).length,
    underconfidence: confidenceBuckets.filter((bucket) => bucket.label === "50-74%" && bucket.correctness >= 90).length,
    userCorrectionRate: (data.productKnowledgeFields || []).length ? Math.round(corrections.filter((entry) => entry.decision === "corrected" || entry.decision === "rejected").length / (data.productKnowledgeFields || []).length * 100) : 0,
  };
}

export function replayProductDecisions(data: OperatingData, productId: string, input: IntelligenceActionInput = {}): IntelligenceReplayRun {
  ensureIntelligenceObservabilityCollections(data);
  const product = data.products.find((entry) => entry.id === productId);
  if (!product) throw new Error("Product not found for replay.");
  const historical = (data.productKnowledgeFields || []).filter((entry) => entry.productId === productId);
  const sourceUrl = product.sourceUrl || productKnowledgeValue(data, productId, "source_url") || `replay://${product.id}`;
  const replayData: OperatingData = { version: 1, mode: "local", updatedAt: now(), products: [{ ...product, id: product.id }], productKnowledgeEvidence: [], productKnowledgeFields: [], productKnowledgeDecisions: [], productKnowledgeMemory: structuredClone(data.productKnowledgeMemory || []), productKnowledgeConfidenceHistory: [], variants: [], locations: [], balances: [], stockMovements: [], suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [] };
  const source: SuperbuyProduct = { source: "1688", importedAt: product.createdAt, title: product.title, superbuyUrl: String(sourceUrl), storeName: String(productKnowledgeValue(data, productId, "supplier_shop") || ""), category: product.category, rawAttributes: Object.fromEntries(historical.map((field) => [field.fieldKey, field.value as string | number | boolean])), images: product.images || [], variants: [], price: Number((productKnowledgeValue(data, productId, "price") as { minimum?: number } | undefined)?.minimum || 0) };
  buildProductKnowledgeFromSuperbuy(replayData, productId, source);
  const keys = new Set<ProductKnowledgeFieldKey>([...historical.map((entry) => entry.fieldKey), ...(replayData.productKnowledgeFields || []).map((entry) => entry.fieldKey)]);
  const changedFields = [...keys].map((fieldKey) => {
    const historicalField = historical.find((entry) => entry.fieldKey === fieldKey);
    const currentField = replayData.productKnowledgeFields?.find((entry) => entry.fieldKey === fieldKey);
    return { fieldKey, historicalValue: historicalField?.value ?? null, currentValue: currentField?.value ?? null, historicalConfidence: historicalField?.confidence || 0, currentConfidence: currentField?.confidence || 0, changed: JSON.stringify(historicalField?.value ?? null) !== JSON.stringify(currentField?.value ?? null) };
  });
  const run: IntelligenceReplayRun = { id: input.idempotencyKey || id(), productId, versionLabel: input.versionLabel || "current", historicalFieldCount: historical.length, currentFieldCount: replayData.productKnowledgeFields?.length || 0, changedFields, deterministic: changedFields.every((entry) => !entry.changed), createdAt: now() };
  data.intelligenceReplayRuns!.unshift(run);
  return run;
}

export function automationRuleEffectiveness(data: OperatingData) {
  return (data.automationRules || []).map((rule) => {
    const runs = (data.automationRuns || []).filter((entry) => entry.ruleId === rule.id);
    const blocked = runs.filter((run) => run.status === "dead_lettered" || run.error?.toLowerCase().includes("blocked")).length;
    return {
      ruleId: rule.id,
      name: rule.name,
      executions: runs.length,
      successRate: runs.length ? Math.round(runs.filter((run) => run.status === "succeeded").length / runs.length * 100) : 0,
      skipped: (data.automationSteps || []).filter((step) => runs.some((run) => run.id === step.runId) && step.status === "skipped").length,
      blocked,
      retries: (data.automationRetries || []).filter((retry) => runs.some((run) => run.id === retry.runId)).length,
      averageDurationMs: average(runs.map((run) => run.durationMs || 0)),
      userOverrides: (data.automationApprovals || []).filter((approval) => approval.ruleId === rule.id && approval.editedPayload).length,
    };
  });
}

export function adapterHealthDashboard(data: OperatingData) {
  const diagnostics = data.marketplaceConnectorDiagnostics || [];
  const marketplaces = [...new Set([...(data.marketplaceAccounts || []).map((entry) => entry.marketplace), ...diagnostics.map((entry) => entry.marketplace)])];
  return marketplaces.map((marketplace) => {
    const entries = diagnostics.filter((entry) => entry.marketplace === marketplace);
    return {
      marketplace,
      publishSuccessRate: percentage(entries.filter((entry) => entry.operation === "publish" && entry.status === "succeeded").length, entries.filter((entry) => entry.operation === "publish").length),
      syncLatency: average(entries.map((entry) => Number(entry.metadata?.durationMs || 0))),
      authenticationFailures: entries.filter((entry) => entry.failureCode?.includes("auth")).length,
      retryCount: entries.filter((entry) => entry.retryable).length,
      rateLimits: entries.filter((entry) => entry.failureCode?.includes("rate")).length,
      diagnostics: entries.length,
    };
  });
}

export function pipelineAnalytics(data: OperatingData) {
  const stageHistory = data.productPipelineStageHistory || [];
  const sessions = data.productPipelineReviewSessions || [];
  return {
    averageImportToReadyMinutes: averageStageMinutes(stageHistory, "imported", "ready"),
    averageReadyToPublishMinutes: averageStageMinutes(stageHistory, "ready", "published"),
    reviewDurationMinutes: average(sessions.map((entry) => entry.completedAt && entry.startedAt ? (new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime()) / 60000 : 0)),
    productsPerSession: sessions.length ? Math.round(sessions.reduce((sum, entry) => sum + entry.productIds.length, 0) / sessions.length) : 0,
    automationSavings: (data.automationMetricSnapshots?.[0]?.timeSavedMinutes || 0),
    blockedStageFrequency: stageHistory.filter((entry) => entry.toStage === "needs_review").length,
  };
}

export function repositoryParityDiagnostics(data: OperatingData, input: IntelligenceActionInput = {}): IntelligenceRepositoryParityCheck {
  ensureIntelligenceObservabilityCollections(data);
  const collections = ["products", "variants", "productKnowledgeEvidence", "productKnowledgeFields", "productKnowledgeMemory", "channelListingDrafts", "automationRules", "automationRuns", "marketplaceConnectorDiagnostics", "intelligenceBenchmarkRuns"] as const;
  const localCounts = Object.fromEntries(collections.map((collection) => [collection, ((data[collection] as unknown[]) || []).length]));
  const productionCounts: Record<string, number> = { ...localCounts };
  const mismatches = Object.entries(localCounts).flatMap(([collection, local]) => productionCounts[collection] === local ? [] : [{ collection, local, production: productionCounts[collection], severity: "blocked" as const }]);
  const check: IntelligenceRepositoryParityCheck = { id: input.idempotencyKey || id(), localCounts, productionCounts, mismatches, schemaVersion: "035_intelligence_observability_studio.sql", ready: mismatches.length === 0, createdAt: now() };
  data.intelligenceRepositoryParityChecks!.unshift(check);
  return check;
}

export function exportDiagnosticsBundle(data: OperatingData, input: IntelligenceActionInput = {}): IntelligenceDiagnosticsBundle {
  ensureIntelligenceObservabilityCollections(data);
  const productId = input.productId || data.products[0]?.id;
  const artifact = {
    product: productId ? data.products.find((entry) => entry.id === productId) : null,
    decisionTimeline: productId ? productDecisionTimeline(data, productId) : [],
    evidenceExplorer: productId ? evidenceExplorer(data, productId) : [],
    benchmarkRuns: data.intelligenceBenchmarkRuns || [],
    automationHistory: data.automationRuns || [],
    connectorDiagnostics: data.marketplaceConnectorDiagnostics || [],
    repositoryParity: data.intelligenceRepositoryParityChecks?.[0] || repositoryParityDiagnostics(data),
  };
  const bundle: IntelligenceDiagnosticsBundle = {
    id: input.idempotencyKey || id(),
    productId,
    label: productId ? `Diagnostics for ${data.products.find((entry) => entry.id === productId)?.title || productId}` : "Workspace diagnostics",
    summary: "Exportable intelligence diagnostics bundle assembled from persisted Faust source records.",
    sections: Object.entries(artifact).map(([name, value]) => ({ name, recordCount: Array.isArray(value) ? value.length : value ? 1 : 0, status: "ok" as const })),
    artifact,
    createdAt: now(),
  };
  data.intelligenceDiagnosticsBundles!.unshift(bundle);
  return bundle;
}

export function intelligenceStudioSummary(data: OperatingData) {
  ensureIntelligenceObservabilityCollections(data);
  const product = data.products[0];
  return {
    productId: product?.id,
    decisionTimeline: product ? productDecisionTimeline(data, product.id) : [],
    evidenceExplorer: product ? evidenceExplorer(data, product.id) : [],
    learningExplorer: learningExplorer(data),
    latestBenchmark: data.intelligenceBenchmarkRuns?.[0],
    latestReplay: data.intelligenceReplayRuns?.[0],
    confidenceCalibration: confidenceCalibration(data),
    ruleEffectiveness: automationRuleEffectiveness(data),
    adapterHealth: adapterHealthDashboard(data),
    pipelineAnalytics: pipelineAnalytics(data),
    repositoryParity: data.intelligenceRepositoryParityChecks?.[0],
    diagnosticsBundles: data.intelligenceDiagnosticsBundles || [],
  };
}

function average(values: number[]) {
  const filtered = values.filter((value) => Number.isFinite(value) && value > 0);
  return filtered.length ? Math.round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length) : 0;
}

function percentage(count: number, total: number) {
  return total ? Math.round(count / total * 100) : 0;
}

function averageStageMinutes(history: NonNullable<OperatingData["productPipelineStageHistory"]>, from: string, to: string) {
  const values = history.flatMap((entry) => entry.fromStage === from && entry.toStage === to ? [0] : []);
  return average(values);
}
