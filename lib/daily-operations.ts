import type { DogfoodingSession, OperatingData, OperationsFeedbackRecord, OperationsSeverity } from "../domain/business";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

export type OperationsFeedbackInput = {
  type: OperationsFeedbackRecord["type"];
  severity: OperationsSeverity;
  workflow: string;
  title: string;
  expectedAction?: string;
  actualAction?: string;
  timeLostMinutes?: number;
  frequency?: number;
  productId?: string;
  variantId?: string;
  linkedRecordType?: string;
  linkedRecordId?: string;
  workaround?: string;
  proposedImprovement?: string;
  source?: OperationsFeedbackRecord["source"];
};

export function ensureDailyOperationsCollections(data: OperatingData) {
  data.operationsFeedback ||= [];
  data.dogfoodingSessions ||= [];
}

export function recordOperationsFeedback(data: OperatingData, input: OperationsFeedbackInput) {
  ensureDailyOperationsCollections(data);
  const time = now();
  const severityRank: Record<OperationsSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const existing = data.operationsFeedback!.find((entry) => entry.status !== "resolved" && entry.workflow === input.workflow && entry.title.toLowerCase() === input.title.toLowerCase());
  const record: OperationsFeedbackRecord = existing || {
    id: id(),
    type: input.type,
    severity: input.severity,
    status: input.severity === "critical" || input.severity === "high" ? "triaged" : "open",
    workflow: input.workflow,
    title: input.title,
    source: input.source || "dogfooding",
    createdAt: time,
    updatedAt: time,
  };
  record.type = input.type;
  record.severity = severityRank[input.severity] > severityRank[record.severity] ? input.severity : record.severity;
  record.status = record.status === "resolved" ? "open" : record.status;
  record.expectedAction = input.expectedAction;
  record.actualAction = input.actualAction;
  record.timeLostMinutes = Math.max(record.timeLostMinutes || 0, input.timeLostMinutes || 0);
  record.frequency = (record.frequency || 0) + Math.max(1, input.frequency || 1);
  record.productId = input.productId;
  record.variantId = input.variantId;
  record.linkedRecordType = input.linkedRecordType;
  record.linkedRecordId = input.linkedRecordId;
  record.workaround = input.workaround;
  record.proposedImprovement = input.proposedImprovement;
  record.updatedAt = time;
  if (!existing) data.operationsFeedback!.unshift(record);
  return record;
}

export function recordDogfoodingSession(data: OperatingData, input: Omit<DogfoodingSession, "id" | "createdAt">) {
  ensureDailyOperationsCollections(data);
  const session: DogfoodingSession = { id: id(), createdAt: now(), ...input };
  data.dogfoodingSessions!.unshift(session);
  return session;
}

export function productionOperationsMetrics(data: OperatingData) {
  ensureDailyOperationsCollections(data);
  const imports = data.activity.filter((event) => /import/i.test(`${event.action} ${event.detail}`));
  const completedImports = (data.productPipelineQueueItems || []).filter((item) => item.status === "resolved").length;
  const activePipelineItems = (data.productPipelineQueueItems || []).filter((item) => item.status === "open");
  const publishTasks = data.marketplacePublishTasks || [];
  const publishAttempts = [...publishTasks, ...(data.channelListingDrafts || []).filter((draft) => ["published", "failed"].includes(draft.status))];
  const successfulPublish = publishAttempts.filter((entry) => entry.status === "published").length;
  const automationRuns = data.automationRuns || [];
  const automationSuccess = automationRuns.filter((run) => run.status === "succeeded").length;
  const automationFailed = automationRuns.filter((run) => ["failed", "dead_lettered"].includes(run.status)).length;
  const syncJobs = [...(data.listingSyncJobs || []), ...(data.durableJobs || []).filter((job) => job.queue === "channel_sync")];
  const failedJobs = [
    ...(data.automationSteps || []).filter((step) => step.status === "failed").map((step) => ({ id: step.id, label: step.label, detail: step.error || "Automation step failed.", href: "/automations" })),
    ...(data.automationDeadLetters || []).filter((entry) => entry.status === "open").map((entry) => ({ id: entry.id, label: "Failed automation task", detail: entry.reason, href: "/automations" })),
    ...(data.listingReviewItems || []).filter((entry) => entry.status === "open").map((entry) => ({ id: entry.id, label: "Marketplace update needs review", detail: entry.detail, href: "/listings" })),
  ];
  const openFeedback = data.operationsFeedback!.filter((entry) => entry.status !== "resolved");
  const criticalOpen = openFeedback.filter((entry) => entry.severity === "critical").length;
  const highOpen = openFeedback.filter((entry) => entry.severity === "high").length;
  const sessions = data.dogfoodingSessions || [];
  const totals = sessions.reduce((sum, session) => ({
    imported: sum.imported + session.productsImported,
    review: sum.review + session.reviewTimeMinutes,
    publish: sum.publish + session.publishingTimeMinutes,
    corrections: sum.corrections + session.correctionsMade,
    automation: sum.automation + session.automationActions,
    failures: sum.failures + session.failuresEncountered,
    friction: sum.friction + session.uiFrictionCount,
  }), { imported: 0, review: 0, publish: 0, corrections: 0, automation: 0, failures: 0, friction: 0 });
  const productsWithDrafts = new Set((data.channelListingDrafts || []).map((draft) => draft.variantId));
  const productsWithPublished = new Set((data.channelListingDrafts || []).filter((draft) => draft.status === "published").map((draft) => draft.variantId));
  const queueDepth = activePipelineItems.length + syncJobs.filter((job) => ["queued", "pending", "retrying"].includes(String(job.status))).length + failedJobs.length;
  const importSuccessRate = imports.length ? Math.round(completedImports / Math.max(imports.length, completedImports) * 100) : 100;
  const publishSuccessRate = publishAttempts.length ? Math.round(successfulPublish / publishAttempts.length * 100) : 100;
  const automationSuccessRate = automationRuns.length ? Math.round(automationSuccess / automationRuns.length * 100) : 100;
  return {
    releaseCandidate: {
      ready: criticalOpen === 0 && highOpen === 0 && failedJobs.length === 0,
      blockers: criticalOpen + highOpen + failedJobs.length,
      summary: criticalOpen ? "Critical dogfooding issues must be fixed before RC." : highOpen ? "High-severity dogfooding issues remain." : failedJobs.length ? "Background failures need review." : "No critical operational blockers detected.",
    },
    metrics: {
      importSuccessRate,
      timeFromImportToPublishMinutes: totals.imported ? Math.round((totals.review + totals.publish) / totals.imported) : 0,
      publishSuccessRate,
      automationSuccessRate,
      reviewTimeMinutes: totals.imported ? Math.round(totals.review / totals.imported) : 0,
      syncLatencyLabel: syncJobs.length ? "Tracked by sync job run-after timestamps" : "No sync jobs",
      errorRate: Math.round((failedJobs.length + automationFailed + openFeedback.filter((entry) => entry.type === "bug").length) / Math.max(1, data.products.length + automationRuns.length + publishAttempts.length) * 100),
      averageUserActionsPerProduct: data.products.length ? Math.round((totals.corrections + totals.friction + totals.automation) / data.products.length) : 0,
    },
    counts: {
      activeProducts: data.products.filter((product) => !["cancelled", "paused"].includes(product.status)).length,
      draftedProducts: productsWithDrafts.size,
      publishedProducts: productsWithPublished.size,
      queueDepth,
      failedJobs: failedJobs.length,
      automationBacklog: (data.automationRuns || []).filter((run) => ["queued", "running", "waiting_approval"].includes(run.status)).length,
      connectorErrors: (data.marketplaceConnectorDiagnostics || []).filter((diagnostic) => diagnostic.status === "failed").length,
      openFeedback: openFeedback.length,
    },
    feedback: openFeedback.sort((a, b) => severityScore(b.severity) - severityScore(a.severity) || b.updatedAt.localeCompare(a.updatedAt)),
    failedJobs,
    recentErrors: [
      ...(data.automationExecutionTraces || []).filter((trace) => trace.level === "error").map((trace) => ({ id: trace.id, title: trace.message, detail: trace.correlationId, at: trace.createdAt })),
      ...(data.marketplaceConnectorDiagnostics || []).filter((entry) => entry.status === "failed").map((entry) => ({ id: entry.id, title: `${entry.marketplace} ${entry.operation} failed`, detail: entry.message, at: entry.createdAt })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10),
    dogfooding: { sessions, totals },
  };
}

function severityScore(severity: OperationsSeverity) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[severity];
}
