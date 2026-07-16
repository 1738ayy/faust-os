import type { AutomationAction, AutomationCondition, AutomationDeadLetter, AutomationEventReceipt, AutomationIdempotencyReceipt, AutomationRule, AutomationRun, AutomationStep, AutomationTemplate, AutomationTriggerType, AutomationWorkerHeartbeat, OperatingData } from "@/domain/business";
import { availableUnits } from "./business-calculations";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

export type AutomationMutationInput = { ruleId?: string; runId?: string; stepId?: string; deadLetterId?: string; templateId?: string; idempotencyKey?: string; name?: string; triggerType?: AutomationTriggerType; dryRun?: boolean; enabled?: boolean; paused?: boolean; threshold?: number; priority?: number; conditionMode?: "AND" | "OR"; samplePayload?: Record<string, unknown>; workerId?: string; concurrency?: number; leaseTimeoutMs?: number; pollingIntervalMs?: number };
export type WorkerRuntimeOptions = { workerId?: string; concurrency?: number; pollingIntervalMs?: number; leaseTimeoutMs?: number; now?: string };

const condition = (field: string, operator: AutomationCondition["operator"], value?: AutomationCondition["value"]): AutomationCondition => ({ id: id(), field, operator, value });
const action = (type: AutomationAction["type"], config: AutomationAction["config"] = {}, flags: Partial<AutomationAction> = {}): AutomationAction => ({ id: id(), type, config, ...flags });

export const realFaustEventTypes: AutomationTriggerType[] = [
  "inventory.adjusted", "inventory.received", "inventory.below_reorder_point", "inventory.stockout_risk", "inventory.risk_lock_created", "inventory.cycle_count_discrepancy",
  "order.imported", "order.payment_received", "order.reservation_failed", "order.ready_to_pack", "order.refund_requested", "order.return_requested", "order.shipping_deadline_approaching",
  "fulfillment.pick_delayed", "fulfillment.pack_delayed", "shipment.dispatched", "tracking.stalled", "fulfillment.exception_created", "shipment.returned_to_sender",
  "payout.received", "payout.discrepancy", "finance.deployable_cash_threshold", "finance.tax_reserve_below_target", "finance.expense_threshold", "finance.budget_exceeded", "order.negative_margin",
  "purchasing.reorder_recommendation_created", "supplier.lead_time_worsened", "purchase_order.approval_required", "parcel.delayed", "supplier.claim_unresolved", "landed_cost.above_target",
  "listing.publish_failed", "listing.quantity_sync_failed", "listing.stale", "listing.sibling_delist_required", "listing.risk_lock_triggered", "listing.performance_below_threshold",
  "analytics.kpi_threshold_crossed", "analytics.saved_report_completed", "analytics.forecast_variance_exceeded", "analytics.dead_stock_detected", "analytics.channel_margin_dropped", "schedule",
];

export function defaultAutomationTemplates(createdAt = now()): AutomationTemplate[] {
  return [
    template("auto-template-low-stock", "Low stock → reorder recommendation → approval → draft PO", "inventory.below_reorder_point", { available: 2 }, [condition("available", "less_or_equal", 2)], [action("create_reorder_recommendation"), action("request_approval", { reason: "Draft PO requires approval" }, { approvalRequired: true }), action("draft_purchase_order", {}, { approvalRequired: true })], true, createdAt),
    template("auto-template-listing-sync", "Failed listing sync → retry → risk lock → alert → dead letter", "listing.quantity_sync_failed", { maxAttempts: 3 }, [condition("status", "equals", "failed")], [action("queue_quantity_sync"), action("place_sku_risk_lock"), action("create_notification")], false, createdAt),
    template("auto-template-sale-delist", "Sale imported → reserve inventory → sibling delist queue → fulfillment task", "order.imported", {}, [condition("marketplace", "exists")], [action("reserve_inventory"), action("queue_sibling_delist"), action("create_task")], false, createdAt),
    template("auto-template-ship-deadline", "Shipping deadline approaching → increase priority → alert", "order.shipping_deadline_approaching", { hoursUntilDeadline: 24 }, [condition("hoursUntilDeadline", "less_or_equal", 24)], [action("create_task", { title: "Priority shipment alert" }), action("create_notification")], false, createdAt),
    template("auto-template-tracking-stalled", "Tracking stalled → fulfillment exception → tracking job", "tracking.stalled", { hoursSinceScan: 72 }, [condition("hoursSinceScan", "greater_or_equal", 72)], [action("create_fulfillment_exception"), action("enqueue_background_job", { queue: "tracking_refresh" })], false, createdAt),
    template("auto-template-negative-margin", "Negative-margin order → Finance alert → review task", "order.negative_margin", { contributionProfit: 0 }, [condition("contributionProfit", "less_than", 0)], [action("create_notification"), action("create_task")], false, createdAt),
    template("auto-template-payout-discrepancy", "Payout discrepancy → reconciliation task", "payout.discrepancy", { discrepancy: 0 }, [condition("discrepancy", "not_equals", 0)], [action("create_task")], false, createdAt),
    template("auto-template-dead-stock", "Dead stock → analytics report → markdown recommendation", "analytics.dead_stock_detected", { daysWithoutSale: 60 }, [condition("daysWithoutSale", "greater_or_equal", 60)], [action("run_saved_report"), action("create_notification")], false, createdAt),
    template("auto-template-supplier-delay", "Supplier delay → increase lead-time estimate → recalculate reorder point → alert", "supplier.lead_time_worsened", { leadTimeDelta: 3 }, [condition("leadTimeDelta", "greater_than", 3)], [action("create_task"), action("create_notification")], false, createdAt),
    template("auto-template-cash-threshold", "Deployable cash above threshold → reinvestment simulation → approval request", "finance.deployable_cash_threshold", { deployableCash: 500 }, [condition("deployableCash", "greater_or_equal", 500)], [action("trigger_forecast_refresh"), action("request_approval", {}, { approvalRequired: true })], true, createdAt),
  ];
}

function template(idValue: string, name: string, triggerType: AutomationTriggerType, thresholds: Record<string, number>, conditions: AutomationCondition[], actions: AutomationAction[], approvalRequired: boolean, createdAt: string): AutomationTemplate {
  return { id: idValue, name, description: name, triggerType, thresholds, conditions, actions, approvalRequired, version: 2, createdAt };
}

export function ensureAutomationCollections(data: OperatingData) {
  data.automationRules ||= []; data.automationRuns ||= []; data.automationSteps ||= []; data.automationApprovals ||= []; data.automationRetries ||= []; data.automationDeadLetters ||= []; data.automationIdempotencyReceipts ||= [];
  data.automationEventReceipts ||= []; data.automationWorkerLeases ||= []; data.automationWorkerHeartbeats ||= []; data.automationExecutionTraces ||= [];
  if (!data.automationTemplates?.length || data.automationTemplates.some((entry) => !entry.version)) data.automationTemplates = defaultAutomationTemplates();
}

export function createAutomationRule(data: OperatingData, input: AutomationMutationInput = {}) {
  ensureAutomationCollections(data);
  const createdAt = now();
  const source = input.templateId ? data.automationTemplates!.find((entry) => entry.id === input.templateId) : undefined;
  const triggerType = input.triggerType || source?.triggerType || "inventory.below_reorder_point";
  const rule: AutomationRule = {
    id: id(), name: input.name || source?.name || "Low stock reorder guard", description: source?.description || "Event-driven automation rule.", enabled: input.enabled ?? false, owner: "system", priority: input.priority || 50,
    version: 1, templateId: source?.id, templateVersion: source?.version, localOverrides: input.threshold !== undefined ? ["threshold"] : [],
    trigger: { type: triggerType, samplePayload: input.samplePayload || sampleEventFor(data, triggerType) }, conditionMode: input.conditionMode || "AND",
    conditions: source?.conditions.map((entry) => ({ ...entry, id: id(), value: input.threshold ?? entry.value })) || [condition("available", "less_or_equal", input.threshold ?? 2)],
    actions: source?.actions.map((entry) => ({ ...entry, id: id() })) || [action("create_notification"), action("create_reorder_recommendation")],
    schedule: { id: id(), frequency: "daily", timezone: "America/New_York", businessHoursOnly: true, missedRunPolicy: "run_once", nextRunAt: nextRun("daily"), createdAt },
    approvalRequired: source?.approvalRequired || false, approverRole: source?.approvalRequired ? "admin" : undefined, dryRun: input.dryRun ?? true, nextRunAt: nextRun("daily"), runCount: 0, failureCount: 0, createdAt, updatedAt: createdAt,
  };
  data.automationRules!.unshift(rule); audit(data, "Automation rule created", "automation_rule", rule.id, `${rule.name} listens for ${rule.trigger.type}.`);
  return rule;
}

export function installAutomationTemplate(data: OperatingData, templateId: string, input: AutomationMutationInput = {}) {
  return createAutomationRule(data, { ...input, templateId, enabled: input.enabled ?? false, dryRun: input.dryRun ?? true });
}

export function duplicateAutomationRule(data: OperatingData, ruleId: string) {
  const source = rule(data, ruleId);
  const copy = createAutomationRule(data, { name: nextCopyName(data, source.name), triggerType: source.trigger.type, dryRun: source.dryRun, enabled: false, priority: source.priority, conditionMode: source.conditionMode, samplePayload: source.trigger.samplePayload });
  copy.conditions = source.conditions.map((entry) => ({ ...entry, id: id() })); copy.actions = source.actions.map((entry) => ({ ...entry, id: id() }));
  copy.approvalRequired = source.approvalRequired; copy.approverRole = source.approverRole; copy.templateId = source.templateId; copy.templateVersion = source.templateVersion; copy.localOverrides = [...(source.localOverrides || [])];
  return copy;
}

export function setAutomationEnabled(data: OperatingData, ruleId: string, enabled: boolean) { const entry = rule(data, ruleId); entry.enabled = enabled; entry.updatedAt = now(); audit(data, enabled ? "Automation enabled" : "Automation disabled", "automation_rule", entry.id, entry.name); return entry; }
export function archiveAutomationRule(data: OperatingData, ruleId: string) { const entry = rule(data, ruleId); entry.enabled = false; entry.archivedAt = now(); entry.updatedAt = now(); audit(data, "Automation archived", "automation_rule", entry.id, entry.name); return entry; }
export function setSchedulePaused(data: OperatingData, ruleId: string, paused: boolean) { const entry = rule(data, ruleId); if (!entry.schedule) throw new Error("Automation rule has no schedule."); entry.schedule.paused = paused; entry.schedule.updatedAt = now(); audit(data, paused ? "Automation schedule paused" : "Automation schedule resumed", "automation_rule", entry.id, entry.name); return entry; }

export function ingestAutomationEvent(data: OperatingData, eventType: AutomationTriggerType, payload: Record<string, unknown>, idempotencyKey = `${eventType}:${String(payload.id || payload.aggregateId || JSON.stringify(payload))}`) {
  ensureAutomationCollections(data);
  const existing = data.automationEventReceipts!.find((entry) => entry.idempotencyKey === idempotencyKey);
  if (existing) return existing;
  const receipt: AutomationEventReceipt = { id: id(), eventId: String(payload.id || id()), eventType, aggregateType: String(payload.aggregateType || eventType.split(".")[0]), aggregateId: String(payload.aggregateId || payload.id || "unknown"), payload, status: "pending", runIds: [], idempotencyKey, receivedAt: now() };
  data.automationEventReceipts!.unshift(receipt);
  const matches = data.automationRules!.filter((entry) => entry.enabled && !entry.archivedAt && entry.trigger.type === eventType);
  receipt.status = matches.length ? "matched" : "ignored";
  for (const entry of matches) {
    const run = runAutomationRule(data, entry.id, payload, `${idempotencyKey}:${entry.id}`);
    receipt.runIds.push(run.id);
  }
  receipt.status = receipt.runIds.length ? "processed" : receipt.status;
  receipt.processedAt = now();
  return receipt;
}

export function runAutomationRule(data: OperatingData, ruleId: string, payload?: Record<string, unknown>, idempotencyKey = `${ruleId}:${JSON.stringify(payload || {})}`, workerId = "inline-worker") {
  ensureAutomationCollections(data);
  const entry = rule(data, ruleId);
  if (!entry.enabled && !entry.dryRun) throw new Error("Automation rule is disabled.");
  const existing = data.automationIdempotencyReceipts!.find((receipt) => receipt.key === idempotencyKey);
  if (existing) return data.automationRuns!.find((run) => run.id === existing.runId)!;
  const started = Date.now(); const traceId = id(); const eventPayload = payload || entry.trigger.samplePayload || sampleEventFor(data, entry.trigger.type);
  const conditionResults = evaluateConditions(entry.conditions, eventPayload, data); const passes = entry.conditionMode === "AND" ? conditionResults.every((item) => item.result) : conditionResults.some((item) => item.result);
  const run: AutomationRun = { id: id(), ruleId: entry.id, triggerType: entry.trigger.type, status: entry.dryRun ? "dry_run" : "running", idempotencyKey, eventPayload, conditionResults, stepIds: [], queueDelayMs: 0, workerId, traceId, correlationId: String(eventPayload.correlationId || traceId), ruleVersion: entry.version, createdAt: now(), startedAt: now() };
  data.automationRuns!.unshift(run); receipt(data, idempotencyKey, entry.id, run.id); trace(data, run, "info", "Automation run started", { ruleId: entry.id });
  if (!passes) { const step = stepFor(run.id, "Conditions did not match", "skipped"); data.automationSteps!.unshift(step); run.stepIds.push(step.id); finishRun(data, entry, run, entry.dryRun ? "dry_run" : "succeeded", started); return run; }
  for (const automationAction of entry.actions) {
    const requiresApproval = !entry.dryRun && approvalRequiredFor(automationAction, entry);
    const step = stepFor(run.id, automationAction.type.replaceAll("_", " "), requiresApproval ? "waiting_approval" : "running", automationAction.id);
    data.automationSteps!.unshift(step); run.stepIds.push(step.id);
    if (step.status === "waiting_approval") { approval(data, entry, run, automationAction); run.status = "waiting_approval"; continue; }
    executeAction(data, entry, run, step, automationAction);
  }
  if (run.status !== "waiting_approval") finishRun(data, entry, run, entry.dryRun ? "dry_run" : "succeeded", started);
  return run;
}

function approvalRequiredFor(automationAction: AutomationAction, rule: AutomationRule) {
  return automationAction.approvalRequired || rule.approvalRequired || ["draft_purchase_order", "move_tax_reserve", "create_expense", "pause_listing", "release_risk_lock"].includes(automationAction.type);
}

export function approveAutomation(data: OperatingData, approvalId: string, approved: boolean, editedPayload?: Record<string, unknown>) {
  ensureAutomationCollections(data); const entry = data.automationApprovals!.find((item) => item.id === approvalId); if (!entry) throw new Error("Automation approval not found.");
  entry.status = approved ? "approved" : "rejected"; entry.decidedAt = now(); entry.decisionBy = "local-admin"; if (editedPayload) entry.editedPayload = editedPayload; entry.history.push(`${entry.decidedAt}: ${entry.status}${editedPayload ? " with edited payload" : ""}`);
  const step = data.automationSteps!.find((item) => item.runId === entry.runId && item.actionId === entry.actionId); if (step) { step.status = approved ? "succeeded" : "cancelled"; step.finishedAt = now(); step.logs.push(approved ? "Approved and completed." : "Rejected by approver."); }
  const run = data.automationRuns!.find((item) => item.id === entry.runId); const sourceRule = run ? data.automationRules!.find((item) => item.id === run.ruleId) : undefined; if (run && sourceRule) finishRun(data, sourceRule, run, approved ? "succeeded" : "cancelled", Date.now());
  return entry;
}

export function expireApprovals(data: OperatingData, at = now()) {
  ensureAutomationCollections(data); const cutoff = new Date(at).getTime();
  return data.automationApprovals!.filter((entry) => entry.status === "pending" && entry.expiresAt && new Date(entry.expiresAt).getTime() <= cutoff).map((entry) => { entry.status = "expired"; entry.history.push(`${at}: Approval expired.`); return entry; });
}

export function retryAutomation(data: OperatingData, runId: string, stepId?: string) {
  ensureAutomationCollections(data); const failed = data.automationRuns!.find((run) => run.id === runId); if (!failed) throw new Error("Automation run not found.");
  const attempt = data.automationRetries!.filter((entry) => entry.runId === runId).length + 1; const retry = { id: id(), runId, stepId, attempt, runAfter: nextBackoff(attempt), status: "scheduled" as const, createdAt: now() };
  data.automationRetries!.unshift(retry); const dead = data.automationDeadLetters!.find((entry) => entry.runId === runId && entry.status === "open"); if (dead) dead.status = "retried";
  return runAutomationRule(data, failed.ruleId, failed.eventPayload, `${failed.id}:retry:${retry.attempt}`);
}

export function replayDeadLetter(data: OperatingData, deadLetterId: string) {
  ensureAutomationCollections(data); const dead = data.automationDeadLetters!.find((entry) => entry.id === deadLetterId); if (!dead) throw new Error("Automation dead letter not found.");
  dead.status = "retried"; dead.resolvedAt = now(); return runAutomationRule(data, dead.ruleId, dead.payload, `${dead.id}:replay`);
}

export function cancelAutomationRun(data: OperatingData, runId: string) { const run = data.automationRuns?.find((entry) => entry.id === runId); if (!run) throw new Error("Automation run not found."); run.status = "cancelled"; run.finishedAt = now(); return run; }
export function testAutomationRule(data: OperatingData, ruleId: string) { const entry = rule(data, ruleId); const originalDryRun = entry.dryRun; entry.dryRun = true; const run = runAutomationRule(data, ruleId, entry.trigger.samplePayload, `${ruleId}:test:${Date.now()}`, "test-worker"); entry.dryRun = originalDryRun; return run; }

export function processAutomationWorkerTick(data: OperatingData, options: WorkerRuntimeOptions = {}) {
  ensureAutomationCollections(data); const workerId = options.workerId || "automation-worker-local"; const heartbeat = beat(data, workerId, options); const due = dueScheduledRules(data, options.now || now()).slice(0, options.concurrency || 4);
  const runs = due.map((entry) => { lease(data, workerId, "schedule", entry.id, options.leaseTimeoutMs || 30000); const run = runAutomationRule(data, entry.id, { triggerType: "schedule", scheduledAt: options.now || now() }, `${entry.id}:schedule:${entry.nextRunAt || now()}`, workerId); if (entry.schedule) { entry.schedule.lastEvaluatedAt = now(); entry.schedule.nextRunAt = nextRun(entry.schedule.frequency, entry.schedule.timezone, entry.schedule.businessHoursOnly); entry.nextRunAt = entry.schedule.nextRunAt; } return run; });
  recoverStaleRuns(data, options.now || now(), options.leaseTimeoutMs || 30000);
  return { heartbeat, runs, dueCount: due.length };
}

export function dueScheduledRules(data: OperatingData, at = now()) {
  ensureAutomationCollections(data); const time = new Date(at).getTime();
  return data.automationRules!.filter((entry) => entry.enabled && !entry.archivedAt && entry.schedule && !entry.schedule.paused && entry.schedule.nextRunAt && new Date(entry.schedule.nextRunAt).getTime() <= time);
}

export function recoverStaleRuns(data: OperatingData, at = now(), leaseTimeoutMs = 30000) {
  const cutoff = new Date(at).getTime() - leaseTimeoutMs;
  return (data.automationRuns || []).filter((run) => run.status === "running" && run.startedAt && new Date(run.startedAt).getTime() < cutoff).map((run) => { run.status = "failed"; run.error = "Stale execution recovered by worker."; deadLetter(data, run, rule(data, run.ruleId), run.error); return run; });
}

function evaluateConditions(conditions: AutomationCondition[], payload: Record<string, unknown>, data: OperatingData) { return conditions.map((entry) => ({ ...entry, result: evaluateCondition(entry, valueAt(entry.field, payload, data)) })); }
function evaluateCondition(condition: AutomationCondition, actual: unknown) {
  const expected = condition.value;
  if (condition.operator === "exists") return actual !== undefined && actual !== null && actual !== ""; if (condition.operator === "does_not_exist") return actual === undefined || actual === null || actual === ""; if (condition.operator === "equals") return actual === expected; if (condition.operator === "not_equals") return actual !== expected;
  if (condition.operator === "contains") return String(actual ?? "").includes(String(expected ?? "")); if (condition.operator === "does_not_contain") return !String(actual ?? "").includes(String(expected ?? "")); if (condition.operator === "in_list") return Array.isArray(expected) && expected.includes(String(actual)); if (condition.operator === "not_in_list") return Array.isArray(expected) && !expected.includes(String(actual));
  const actualNumber = Number(actual || 0), expectedNumber = Number(expected || 0); if (condition.operator === "greater_than") return actualNumber > expectedNumber; if (condition.operator === "less_than") return actualNumber < expectedNumber; if (condition.operator === "greater_or_equal") return actualNumber >= expectedNumber; if (condition.operator === "less_or_equal") return actualNumber <= expectedNumber; if (condition.operator === "age_exceeds") return actualNumber >= expectedNumber; if (condition.operator === "percentage_change_exceeds") return Math.abs(actualNumber) >= expectedNumber; if (condition.operator === "date_time_window") return true; return false;
}

function executeAction(data: OperatingData, rule: AutomationRule, run: AutomationRun, step: AutomationStep, automationAction: AutomationAction) {
  try {
    if (rule.dryRun) { step.status = "succeeded"; step.logs.push("Dry run: action was evaluated but not persisted."); return; }
    if (automationAction.type === "create_notification") dedupedNotice(data, rule, run, automationAction, step);
    else if (automationAction.type === "create_task" || automationAction.type === "request_approval") createTask(data, rule, automationAction, step);
    else if (automationAction.type === "create_reorder_recommendation") createReorder(data, step);
    else if (automationAction.type === "place_sku_risk_lock") placeRiskLock(data, rule, step);
    else if (automationAction.type === "queue_quantity_sync" || automationAction.type === "queue_sibling_delist") queueOutbox(data, rule, run, automationAction, step);
    else if (automationAction.type === "create_fulfillment_exception") createFulfillmentException(data, rule, run, step);
    else enqueueJob(data, rule, run, automationAction, step);
    step.status = "succeeded"; step.finishedAt = now(); step.logs.push("Action completed."); trace(data, run, "info", `${automationAction.type} completed`, { linkedRecords: step.linkedRecords }); audit(data, "Automation action executed", "automation_run", run.id, `${automationAction.type} completed.`);
  } catch (error) { step.status = "failed"; step.error = error instanceof Error ? error.message : "Automation action failed."; step.finishedAt = now(); run.status = "failed"; run.error = step.error; deadLetter(data, run, rule, step.error); incident(data, run, step); }
}

function dedupedNotice(data: OperatingData, rule: AutomationRule, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) {
  const title = automationAction.config.title ? String(automationAction.config.title) : rule.name;
  const existing = data.notices.find((notice) => !notice.resolved && notice.entityType === "automation_run" && notice.entityId === run.id && notice.title === title);
  if (existing) { step.linkedRecords.push({ type: "notification", id: existing.id, href: "/automations" }); return; }
  const notice = { id: id(), severity: "warning" as const, title, detail: `Automation ${rule.name} triggered.`, actionLabel: "Review automation", href: "/automations", createdAt: now(), category: "system" as const, entityType: "automation_run", entityId: run.id, read: false };
  data.notices.unshift(notice); step.linkedRecords.push({ type: "notification", id: notice.id, href: "/automations" });
}
function createTask(data: OperatingData, rule: AutomationRule, automationAction: AutomationAction, step: AutomationStep) { const task = { id: id(), title: automationAction.config.title ? String(automationAction.config.title) : `Automation follow-up: ${rule.name}`, status: "open" as const, priority: "high" as const, entityType: "automation_rule", entityId: rule.id, createdAt: now() }; data.tasks.unshift(task); step.linkedRecords.push({ type: "task", id: task.id, href: "/tasks" }); }
function createReorder(data: OperatingData, step: AutomationStep) { const variant = data.variants[0]; const balance = variant ? data.balances.find((entry) => entry.variantId === variant.id) : undefined; if (variant) { const rec = { id: id(), variantId: variant.id, supplierId: data.products.find((product) => product.id === variant.productId)?.supplierId, recommendedQuantity: variant.reorderQuantity, reorderPoint: variant.reorderPoint, safetyStock: Math.ceil(variant.reorderQuantity / 2), available: balance ? availableUnits(balance) : 0, incoming: balance?.incoming || 0, velocity30d: 1, estimatedCostUsd: variant.reorderQuantity * variant.landedUnitCost, status: "open" as const, createdAt: now() }; data.reorderRecommendations ||= []; data.reorderRecommendations.unshift(rec); step.linkedRecords.push({ type: "reorder_recommendation", id: rec.id, href: "/purchasing" }); } }
function placeRiskLock(data: OperatingData, rule: AutomationRule, step: AutomationStep) { const variant = data.variants[0]; if (variant) { data.inventoryRiskLocks ||= []; const lock = { id: id(), variantId: variant.id, reason: "manual_hold" as const, status: "active" as const, lockedQuantity: 1, createdAt: now(), notes: `Automation ${rule.name}` }; data.inventoryRiskLocks.unshift(lock); step.linkedRecords.push({ type: "inventory_risk_lock", id: lock.id, href: "/listings" }); } }
function queueOutbox(data: OperatingData, rule: AutomationRule, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { const event = { id: id(), topic: "channel.inventory.sync_requested" as const, aggregateType: "automation_rule", aggregateId: rule.id, payload: { action: automationAction.type, runId: run.id }, status: "pending" as const, attempts: 0, createdAt: now() }; data.outboxEvents ||= []; data.outboxEvents.unshift(event); step.linkedRecords.push({ type: "outbox_event", id: event.id }); }
function createFulfillmentException(data: OperatingData, rule: AutomationRule, run: AutomationRun, step: AutomationStep) { data.fulfillmentExceptions ||= []; const exception = { id: id(), type: "carrier_delay" as const, severity: "warning" as const, notes: `Automation ${rule.name} opened from run ${run.id}.`, status: "open" as const, activity: [`${now()}: Automation exception created.`], createdAt: now() }; data.fulfillmentExceptions.unshift(exception); step.linkedRecords.push({ type: "fulfillment_exception", id: exception.id, href: "/shipping" }); }
function enqueueJob(data: OperatingData, rule: AutomationRule, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { const job = { id: id(), queue: "inventory_risk" as const, status: "queued" as const, attempts: 0, maxAttempts: 3, payload: { action: automationAction.type, ruleId: rule.id, runId: run.id }, runAfter: now(), createdAt: now() }; data.durableJobs ||= []; data.durableJobs.unshift(job); step.linkedRecords.push({ type: "durable_job", id: job.id }); }

function sampleEventFor(data: OperatingData, type: AutomationTriggerType) { const variant = data.variants[0], balance = variant ? data.balances.find((entry) => entry.variantId === variant.id) : undefined; return { triggerType: type, sku: variant?.sku || "FST-HOOD-001", available: balance ? availableUnits(balance) : 0, reorderPoint: variant?.reorderPoint || 2, marketplace: data.orders[0]?.marketplace || "Depop", status: "failed", deployableCash: 600, contributionProfit: -1, hoursUntilDeadline: 12, hoursSinceScan: 80, discrepancy: 10, daysWithoutSale: 75, leadTimeDelta: 5 }; }
function valueAt(field: string, payload: Record<string, unknown>, data: OperatingData) { if (field in payload) return payload[field]; if (field === "available") { const variant = data.variants[0]; const balance = variant ? data.balances.find((entry) => entry.variantId === variant.id) : undefined; return balance ? availableUnits(balance) : 0; } return undefined; }
export function nextRun(frequency: string, timezone = "America/New_York", businessHoursOnly = false) { void timezone; const date = new Date(); if (frequency === "hourly") date.setHours(date.getHours() + 1); else if (frequency === "weekly") date.setDate(date.getDate() + 7); else if (frequency === "monthly") date.setMonth(date.getMonth() + 1); else date.setDate(date.getDate() + 1); if (businessHoursOnly && (date.getHours() < 9 || date.getHours() > 17)) date.setHours(9, 0, 0, 0); return date.toISOString(); }
export function nextBackoff(attempt: number, jitterMs = 137) { const date = new Date(); date.setMilliseconds(date.getMilliseconds() + Math.min(3600000, 1000 * 2 ** attempt) + jitterMs); return date.toISOString(); }
function stepFor(runId: string, label: string, status: AutomationStep["status"], actionId?: string): AutomationStep { return { id: id(), runId, actionId, label, status, attempts: 1, maxAttempts: 3, startedAt: now(), logs: [], linkedRecords: [] }; }
function finishRun(data: OperatingData, rule: AutomationRule, run: AutomationRun, status: AutomationRun["status"], started: number) { run.status = status; run.finishedAt = now(); run.durationMs = Date.now() - started; rule.lastRunAt = run.finishedAt; rule.runCount += 1; if (status === "failed" || status === "dead_lettered") rule.failureCount += 1; if (status === "succeeded") data.notices.forEach((notice) => { if (notice.entityType === "automation_run" && notice.entityId === run.id) notice.resolved = true; }); audit(data, "Automation run finished", "automation_run", run.id, `${rule.name}: ${status}`); }
function audit(data: OperatingData, action: string, entityType: string, entityId: string, detail: string) { data.activity.unshift({ id: id(), action, entityType, entityId, detail, createdAt: now() }); }
function receipt(data: OperatingData, key: string, ruleId: string, runId: string): AutomationIdempotencyReceipt { const entry = { id: id(), key, ruleId, runId, createdAt: now() }; data.automationIdempotencyReceipts!.unshift(entry); return entry; }
function approval(data: OperatingData, rule: AutomationRule, run: AutomationRun, automationAction: AutomationAction) { const requestedAt = now(); data.automationApprovals!.unshift({ id: id(), ruleId: rule.id, runId: run.id, actionId: automationAction.id, status: "pending", approverRole: rule.approverRole || "admin", requestedBy: "automation-worker", reason: String(automationAction.config.reason || `Approval required for ${automationAction.type}`), linkedRecords: [{ type: "automation_run", id: run.id, href: "/automations" }], proposedAction: automationAction.type, beforeValue: {}, afterValue: automationAction.config, expiresAt: new Date(Date.now() + 86400000).toISOString(), escalationAt: new Date(Date.now() + 43200000).toISOString(), requestedAt, history: [`${requestedAt}: Approval requested for ${automationAction.type}.`] }); }
function deadLetter(data: OperatingData, run: AutomationRun, rule: AutomationRule, reason = "Automation failed"): AutomationDeadLetter { const entry = { id: id(), runId: run.id, ruleId: rule.id, reason, payload: run.eventPayload, status: "open" as const, createdAt: now() }; data.automationDeadLetters!.unshift(entry); run.status = "dead_lettered"; return entry; }
function incident(data: OperatingData, run: AutomationRun, step: AutomationStep) { const existing = data.notices.find((notice) => !notice.resolved && notice.entityType === "automation_step" && notice.entityId === step.id); if (!existing) data.notices.unshift({ id: id(), severity: "critical", title: "Automation failed", detail: `${step.label}: ${step.error || "Unknown error"}`, actionLabel: "Retry automation", href: "/automations", createdAt: now(), category: "system", entityType: "automation_step", entityId: step.id, read: false }); trace(data, run, "error", "Automation incident created", { stepId: step.id }); }
function trace(data: OperatingData, run: AutomationRun, level: "info" | "warning" | "error", message: string, payload?: Record<string, unknown>) { data.automationExecutionTraces!.unshift({ id: id(), runId: run.id, workerId: run.workerId, correlationId: run.correlationId || run.id, level, message, payload, createdAt: now() }); }
function beat(data: OperatingData, workerId: string, options: WorkerRuntimeOptions): AutomationWorkerHeartbeat { const heartbeat: AutomationWorkerHeartbeat = { id: id(), workerId, status: "healthy", concurrency: options.concurrency || 4, pollingIntervalMs: options.pollingIntervalMs || 5000, leaseTimeoutMs: options.leaseTimeoutMs || 30000, lastBeatAt: now(), startedAt: now(), detail: "Worker tick processed." }; data.automationWorkerHeartbeats!.unshift(heartbeat); return heartbeat; }
function lease(data: OperatingData, workerId: string, resourceType: "outbox" | "schedule" | "retry" | "dead_letter" | "stale_run", resourceId: string, leaseTimeoutMs: number) { data.automationWorkerLeases!.unshift({ id: id(), workerId, resourceType, resourceId, status: "active", acquiredAt: now(), expiresAt: new Date(Date.now() + leaseTimeoutMs).toISOString() }); }
function rule(data: OperatingData, ruleId: string) { ensureAutomationCollections(data); const entry = data.automationRules!.find((item) => item.id === ruleId); if (!entry) throw new Error("Automation rule not found."); return entry; }
function nextCopyName(data: OperatingData, sourceName: string) { const names = new Set((data.automationRules || []).map((entry) => entry.name)); const base = `${sourceName} copy`; if (!names.has(base)) return base; for (let index = 2; ; index += 1) { const candidate = `${base} ${index}`; if (!names.has(candidate)) return candidate; } }
