import type { AutomationAction, AutomationCondition, AutomationDeadLetter, AutomationEventReceipt, AutomationIdempotencyReceipt, AutomationRule, AutomationRun, AutomationStep, AutomationTemplate, AutomationTriggerType, AutomationWorkerHeartbeat, OperatingData } from "@/domain/business";
import { availableUnits } from "./business-calculations";
import { advanceOrder } from "./operational-workflows";
import { recordAnalyticsReportRun } from "./analytics";
import { coordinateSoldItem, pauseOrDelistDraft, retryFailedListingSync, syncDraftQuantity } from "./listings-core";
import { create1688PurchaseOrder, generateReorderRecommendations, refreshSupplierScorecards } from "./purchasing-core";

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
    if (run.status === "failed" || run.status === "dead_lettered") break;
  }
  if (!["waiting_approval", "failed", "dead_lettered"].includes(run.status)) finishRun(data, entry, run, entry.dryRun ? "dry_run" : "succeeded", started);
  return run;
}

function approvalRequiredFor(automationAction: AutomationAction, rule: AutomationRule) {
  return automationAction.approvalRequired || rule.approvalRequired || ["draft_purchase_order", "move_tax_reserve", "create_expense", "create_inventory_adjustment", "pause_listing", "place_order_on_hold", "place_shipment_hold"].includes(automationAction.type);
}

export function approveAutomation(data: OperatingData, approvalId: string, approved: boolean, editedPayload?: Record<string, unknown>) {
  ensureAutomationCollections(data); const entry = data.automationApprovals!.find((item) => item.id === approvalId); if (!entry) throw new Error("Automation approval not found.");
  entry.status = approved ? "approved" : "rejected"; entry.decidedAt = now(); entry.decisionBy = "local-admin"; if (editedPayload) entry.editedPayload = editedPayload; entry.history.push(`${entry.decidedAt}: ${entry.status}${editedPayload ? " with edited payload" : ""}`);
  const step = data.automationSteps!.find((item) => item.runId === entry.runId && item.actionId === entry.actionId);
  const run = data.automationRuns!.find((item) => item.id === entry.runId); const sourceRule = run ? data.automationRules!.find((item) => item.id === run.ruleId) : undefined;
  if (step && run && sourceRule) {
    if (!approved) { step.status = "cancelled"; step.finishedAt = now(); step.logs.push("Rejected by approver."); finishRun(data, sourceRule, run, "cancelled", Date.now()); return entry; }
    const sourceAction = sourceRule.actions.find((item) => item.id === step.actionId);
    if (sourceAction && sourceAction.type !== "request_approval") {
      step.status = "running"; step.logs.push("Approval granted; executing approved action.");
      executeAction(data, sourceRule, run, step, { ...sourceAction, config: { ...sourceAction.config, ...(entry.editedPayload as AutomationAction["config"] | undefined) } });
    } else {
      step.status = "succeeded"; step.finishedAt = now(); step.logs.push("Approval recorded.");
    }
    const waiting = data.automationSteps!.some((item) => item.runId === run.id && item.status === "waiting_approval");
    if (!waiting && run.status === "waiting_approval") finishRun(data, sourceRule, run, "succeeded", Date.now());
  }
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
  const before = structuredClone(data) as OperatingData;
  try {
    if (rule.dryRun) { step.status = "succeeded"; step.logs.push("Dry run: action was evaluated but not persisted."); return; }
    executeModuleAction(data, rule, run, step, automationAction);
    step.status = "succeeded"; step.finishedAt = now(); step.logs.push("Action completed."); trace(data, run, "info", `${automationAction.type} completed`, { linkedRecords: step.linkedRecords }); audit(data, "Automation action executed", "automation_run", run.id, `${automationAction.type} completed.`);
  } catch (error) { restore(data, before); const liveRun = data.automationRuns!.find((item) => item.id === run.id) || run; const liveStep = data.automationSteps!.find((item) => item.id === step.id) || step; liveStep.status = "failed"; liveStep.error = error instanceof Error ? error.message : "Automation action failed."; liveStep.finishedAt = now(); liveStep.logs.push("Rolled back action state after failure."); liveRun.status = "failed"; liveRun.error = liveStep.error; run.status = "failed"; run.error = liveStep.error; deadLetter(data, liveRun, rule, liveStep.error); incident(data, liveRun, liveStep); }
}

function executeModuleAction(data: OperatingData, rule: AutomationRule, run: AutomationRun, step: AutomationStep, automationAction: AutomationAction) {
  if (automationAction.type === "create_notification") dedupedNotice(data, rule, run, automationAction, step);
  else if (automationAction.type === "create_task" || automationAction.type === "request_approval") createTask(data, rule, automationAction, step);
  else if (automationAction.type === "create_reorder_recommendation") createReorder(data, step);
  else if (automationAction.type === "draft_purchase_order") draftPurchaseOrder(data, run, step);
  else if (automationAction.type === "reserve_inventory") reserveInventory(data, run, step);
  else if (automationAction.type === "release_reservation") releaseReservation(data, run, step);
  else if (automationAction.type === "create_inventory_adjustment") createInventoryAdjustment(data, run, automationAction, step);
  else if (automationAction.type === "create_cycle_count_task") createTypedTask(data, "Cycle count review", "inventory_balance", balanceFromRun(data, run)?.id, "/inventory", step);
  else if (automationAction.type === "place_sku_risk_lock" || automationAction.type === "place_listing_risk_lock") placeRiskLock(data, rule, step);
  else if (automationAction.type === "release_risk_lock" || automationAction.type === "release_listing_risk_lock") releaseRiskLock(data, step);
  else if (automationAction.type === "pause_listing") pauseListing(data, run, step);
  else if (automationAction.type === "queue_quantity_sync") queueQuantitySync(data, run, automationAction, step);
  else if (automationAction.type === "queue_sibling_delist") queueSiblingDelist(data, rule, run, automationAction, step);
  else if (automationAction.type === "retry_listing_sync") retryListing(data, run, step);
  else if (automationAction.type === "create_fulfillment_exception") createFulfillmentException(data, rule, run, step);
  else if (automationAction.type === "increase_fulfillment_priority") updateFulfillment(data, run, step, { priority: "urgent" });
  else if (automationAction.type === "assign_fulfillment") updateFulfillment(data, run, step, { picker: String(automationAction.config.picker || "Automation picker"), packer: String(automationAction.config.packer || "Automation packer"), station: String(automationAction.config.station || "Automation station") });
  else if (automationAction.type === "place_order_on_hold") placeOrderHold(data, run, step);
  else if (automationAction.type === "release_order_hold") releaseOrderHold(data, run, step);
  else if (automationAction.type === "add_order_tag") addOrderTag(data, run, automationAction, step);
  else if (automationAction.type === "queue_refund_approval") createTypedTask(data, "Refund approval review", "order", orderFromRun(data, run)?.id, "/orders", step);
  else if (automationAction.type === "queue_return_review") createTypedTask(data, "Return review", "order", orderFromRun(data, run)?.id, "/orders", step);
  else if (automationAction.type === "place_shipment_hold") updateFulfillment(data, run, step, { hold: true });
  else if (automationAction.type === "release_shipment_hold") updateFulfillment(data, run, step, { hold: false });
  else if (automationAction.type === "enqueue_tracking_refresh") enqueueJob(data, rule, run, { ...automationAction, config: { ...automationAction.config, queue: "tracking_refresh" } }, step);
  else if (automationAction.type === "create_expense") createExpense(data, run, automationAction, step);
  else if (automationAction.type === "create_payout_reconciliation_task") createTypedTask(data, "Payout reconciliation review", "payout", String(run.eventPayload.payoutId || ""), "/finance", step);
  else if (automationAction.type === "simulate_reinvestment_allocation") simulateReinvestment(data, run, step);
  else if (automationAction.type === "move_tax_reserve") moveTaxReserve(data, run, automationAction, step);
  else if (automationAction.type === "create_negative_margin_review" || automationAction.type === "update_budget_alert") createFinanceReview(data, run, automationAction, step);
  else if (automationAction.type === "run_saved_report") runSavedReport(data, run, step);
  else if (automationAction.type === "trigger_forecast_refresh") refreshForecast(data, run, step);
  else if (automationAction.type === "create_kpi_alert") dedupedNotice(data, rule, run, { ...automationAction, config: { title: "KPI threshold crossed" } }, step);
  else if (automationAction.type === "create_dead_stock_review") createTypedTask(data, "Dead stock review", "variant", variantFromRun(data, run)?.id, "/analytics", step);
  else if (automationAction.type === "request_po_approval") requestPoApproval(data, run, step);
  else if (automationAction.type === "update_supplier_lead_time") updateSupplierLeadTime(data, run, automationAction, step);
  else if (automationAction.type === "open_supplier_review_task") createTypedTask(data, "Supplier review", "supplier", data.suppliers[0]?.id, "/purchasing", step);
  else if (automationAction.type === "enqueue_background_job" || automationAction.type === "send_email_boundary" || automationAction.type === "call_webhook_boundary") enqueueJob(data, rule, run, automationAction, step);
  else exhaustiveAction(automationAction);
}

function dedupedNotice(data: OperatingData, rule: AutomationRule, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) {
  const title = automationAction.config.title ? String(automationAction.config.title) : rule.name;
  const existing = data.notices.find((notice) => !notice.resolved && notice.entityType === "automation_run" && notice.entityId === run.id && notice.title === title);
  if (existing) { step.linkedRecords.push({ type: "notification", id: existing.id, href: "/automations" }); return; }
  const notice = { id: id(), severity: "warning" as const, title, detail: `Automation ${rule.name} triggered.`, actionLabel: "Review automation", href: "/automations", createdAt: now(), category: "system" as const, entityType: "automation_run", entityId: run.id, read: false };
  data.notices.unshift(notice); step.linkedRecords.push({ type: "notification", id: notice.id, href: "/automations" });
}
function createTask(data: OperatingData, rule: AutomationRule, automationAction: AutomationAction, step: AutomationStep) { const task = { id: id(), title: automationAction.config.title ? String(automationAction.config.title) : `Automation follow-up: ${rule.name}`, status: "open" as const, priority: "high" as const, entityType: "automation_rule", entityId: rule.id, createdAt: now() }; data.tasks.unshift(task); step.linkedRecords.push({ type: "task", id: task.id, href: "/tasks" }); }
function createReorder(data: OperatingData, step: AutomationStep) { generateReorderRecommendations(data); const rec = data.reorderRecommendations?.[0]; if (rec) step.linkedRecords.push({ type: "reorder_recommendation", id: rec.id, href: "/purchasing" }); }
function draftPurchaseOrder(data: OperatingData, run: AutomationRun, step: AutomationStep) {
  const variant = variantFromRun(data, run); if (!variant) throw new Error("Variant is required before drafting a purchase order.");
  let supplier = data.suppliers[0]; if (!supplier) { supplier = { id: id(), name: "Automation supplier review", sourcePlatform: "Manual", status: "active" as const, leadDays: 12 }; data.suppliers.unshift(supplier); }
  create1688PurchaseOrder(data, { supplierId: supplier.id, reference: `AUTO-PO-${Date.now()}`, currency: "USD", exchangeRate: 1, items: [{ variantId: variant.id, expectedQuantity: variant.reorderQuantity || 1, unitCost: variant.landedUnitCost }], idempotencyKey: `${run.id}:draft-po` });
  refreshSupplierScorecards(data);
  const po = data.purchaseOrders[0]; step.linkedRecords.push({ type: "purchase_order", id: po.id, href: "/purchasing" });
}
function reserveInventory(data: OperatingData, run: AutomationRun, step: AutomationStep) { const order = orderFromRun(data, run); if (!order) throw new Error("Order is required before reserving inventory."); const result = advanceOrder(order, data.balances, "reserved"); Object.assign(order, result.order); data.balances.splice(0, data.balances.length, ...result.balances); data.stockMovements.unshift(...result.movements.map((movement) => ({ id: id(), createdAt: now(), ...movement }))); step.linkedRecords.push({ type: "order", id: order.id, href: "/orders" }); }
function releaseReservation(data: OperatingData, run: AutomationRun, step: AutomationStep) { const order = orderFromRun(data, run); if (!order) throw new Error("Order is required before releasing inventory."); const result = advanceOrder(order, data.balances, "cancelled"); Object.assign(order, result.order); data.balances.splice(0, data.balances.length, ...result.balances); data.stockMovements.unshift(...result.movements.map((movement) => ({ id: id(), createdAt: now(), ...movement }))); step.linkedRecords.push({ type: "order", id: order.id, href: "/orders" }); }
function createInventoryAdjustment(data: OperatingData, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { const balance = balanceFromRun(data, run); if (!balance) throw new Error("Inventory balance is required before adjustment."); const quantity = Number(automationAction.config.quantity || 0); if (!Number.isInteger(quantity) || quantity === 0) throw new Error("Inventory adjustment quantity must be a non-zero whole number."); if (balance.onHand + quantity < balance.reserved) throw new Error("Inventory adjustment cannot reduce on-hand below reservations."); balance.onHand += quantity; const movement = { id: id(), variantId: balance.variantId, quantity, onHandDelta: quantity, reservedDelta: 0, type: "manual_adjustment" as const, referenceType: "automation_run", referenceId: run.id, note: "Automation-approved inventory adjustment", createdAt: now() }; data.stockMovements.unshift(movement); step.linkedRecords.push({ type: "stock_movement", id: movement.id, href: "/inventory" }); }
function placeRiskLock(data: OperatingData, rule: AutomationRule, step: AutomationStep) { const variant = data.variants[0]; if (variant) { data.inventoryRiskLocks ||= []; const lock = { id: id(), variantId: variant.id, reason: "manual_hold" as const, status: "active" as const, lockedQuantity: 1, createdAt: now(), notes: `Automation ${rule.name}` }; data.inventoryRiskLocks.unshift(lock); step.linkedRecords.push({ type: "inventory_risk_lock", id: lock.id, href: "/listings" }); } }
function releaseRiskLock(data: OperatingData, step: AutomationStep) { data.inventoryRiskLocks ||= []; const lock = data.inventoryRiskLocks.find((entry) => entry.status === "active"); if (!lock) throw new Error("No active risk lock exists."); lock.status = "released"; lock.releasedAt = now(); step.linkedRecords.push({ type: "inventory_risk_lock", id: lock.id, href: "/listings" }); }
function queueQuantitySync(data: OperatingData, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { const draft = draftFromRun(data, run); if (!draft) throw new Error("Channel draft is required before queueing quantity sync."); if (data.listingSyncJobs?.some((job) => job.channelDraftId === draft.id && ["failed", "dead_lettered"].includes(job.status))) retryFailedListingSync(data, { draftId: draft.id, idempotencyKey: `${run.id}:retry-sync` }); syncDraftQuantity(data, { draftId: draft.id, quantity: Number(automationAction.config.quantity ?? draft.quantity), idempotencyKey: `${run.id}:quantity-sync` }); step.linkedRecords.push({ type: "channel_listing_draft", id: draft.id, href: "/listings" }); }
function queueSiblingDelist(data: OperatingData, rule: AutomationRule, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { const draft = draftFromRun(data, run); if (draft) { coordinateSoldItem(data, { draftId: draft.id, idempotencyKey: `${run.id}:sibling-delist` }); step.linkedRecords.push({ type: "channel_listing_draft", id: draft.id, href: "/listings" }); } else queueOutbox(data, rule, run, automationAction, step); }
function pauseListing(data: OperatingData, run: AutomationRun, step: AutomationStep) { const draft = draftFromRun(data, run); if (!draft) throw new Error("Channel draft is required before pausing a listing."); pauseOrDelistDraft(data, { draftId: draft.id, mode: "pause", reason: "Automation pause", idempotencyKey: `${run.id}:pause` }); step.linkedRecords.push({ type: "channel_listing_draft", id: draft.id, href: "/listings" }); }
function retryListing(data: OperatingData, run: AutomationRun, step: AutomationStep) { const draft = draftFromRun(data, run); if (!draft) throw new Error("Channel draft is required before retrying listing sync."); retryFailedListingSync(data, { draftId: draft.id, idempotencyKey: `${run.id}:retry-listing` }); step.linkedRecords.push({ type: "channel_listing_draft", id: draft.id, href: "/listings" }); }
function queueOutbox(data: OperatingData, rule: AutomationRule, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { const event = { id: id(), topic: "channel.inventory.sync_requested" as const, aggregateType: "automation_rule", aggregateId: rule.id, payload: { action: automationAction.type, runId: run.id }, status: "pending" as const, attempts: 0, createdAt: now() }; data.outboxEvents ||= []; data.outboxEvents.unshift(event); step.linkedRecords.push({ type: "outbox_event", id: event.id }); }
function createFulfillmentException(data: OperatingData, rule: AutomationRule, run: AutomationRun, step: AutomationStep) { data.fulfillmentExceptions ||= []; const exception = { id: id(), type: "carrier_delay" as const, severity: "warning" as const, notes: `Automation ${rule.name} opened from run ${run.id}.`, status: "open" as const, activity: [`${now()}: Automation exception created.`], createdAt: now() }; data.fulfillmentExceptions.unshift(exception); step.linkedRecords.push({ type: "fulfillment_exception", id: exception.id, href: "/shipping" }); }
function placeOrderHold(data: OperatingData, run: AutomationRun, step: AutomationStep) { const order = orderFromRun(data, run); if (!order) throw new Error("Order is required before placing a hold."); order.tags = [...new Set([...(order.tags || []), "automation-hold"])]; order.notes = [order.notes, "Automation hold placed."].filter(Boolean).join("\n"); order.statusEvents = [...(order.statusEvents || []), { id: id(), fromStatus: order.status, toStatus: order.status, detail: "Automation hold placed", createdAt: now() }]; step.linkedRecords.push({ type: "order", id: order.id, href: "/orders" }); }
function releaseOrderHold(data: OperatingData, run: AutomationRun, step: AutomationStep) { const order = orderFromRun(data, run); if (!order) throw new Error("Order is required before releasing a hold."); order.tags = (order.tags || []).filter((tag) => tag !== "automation-hold"); order.statusEvents = [...(order.statusEvents || []), { id: id(), fromStatus: order.status, toStatus: order.status, detail: "Automation hold released", createdAt: now() }]; step.linkedRecords.push({ type: "order", id: order.id, href: "/orders" }); }
function addOrderTag(data: OperatingData, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { const order = orderFromRun(data, run); if (!order) throw new Error("Order is required before tagging."); const tag = String(automationAction.config.tag || "automation-review"); order.tags = [...new Set([...(order.tags || []), tag])]; step.linkedRecords.push({ type: "order", id: order.id, href: "/orders" }); }
function updateFulfillment(data: OperatingData, run: AutomationRun, step: AutomationStep, input: { priority?: "standard" | "high" | "urgent"; picker?: string; packer?: string; station?: string; hold?: boolean }) { data.fulfillmentShipments ||= []; const shipment = data.fulfillmentShipments.find((entry) => entry.id === run.eventPayload.shipmentId || entry.orderId === run.eventPayload.orderId) || data.fulfillmentShipments[0]; if (!shipment) throw new Error("Shipment is required before fulfillment automation can update it."); if (input.priority) shipment.priority = input.priority; if (input.picker) shipment.picker = input.picker; if (input.packer) shipment.packer = input.packer; if (input.station) shipment.station = input.station; if (input.hold !== undefined) shipment.hold = input.hold ? { active: true, reason: "Automation hold", createdAt: now() } : { ...(shipment.hold || { active: false }), active: false, releasedAt: now() }; shipment.updatedAt = now(); shipment.events.unshift({ id: id(), status: shipment.status, label: "Automation fulfillment update.", timestamp: now() }); step.linkedRecords.push({ type: "fulfillment_shipment", id: shipment.id, href: "/shipping" }); }
function createExpense(data: OperatingData, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { data.expenses ||= []; data.transactions ||= []; const expense = { id: id(), vendor: String(automationAction.config.vendor || "Automation"), category: String(automationAction.config.category || "Operations"), amount: Number(automationAction.config.amount || 0), date: now(), recurring: "none" as const, taxDeductible: true, receiptStatus: "pending_attachment" as const, notes: `Created by automation run ${run.id}.`, createdAt: now(), audit: [`${now()}: Automation expense created.`] }; data.expenses.unshift(expense); data.transactions.unshift({ id: id(), type: "expense", amount: -Math.abs(expense.amount), status: "cleared", occurredAt: expense.date, expenseId: expense.id, sourceType: "expense", sourceId: expense.id, linkedObjectType: "expense", linkedObjectId: expense.id, description: `${expense.vendor} ${expense.category}`, category: expense.category, audit: [`${now()}: Posted by automation.`] }); step.linkedRecords.push({ type: "expense", id: expense.id, href: "/finance" }); }
function moveTaxReserve(data: OperatingData, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { data.taxReserveMovements ||= []; const movement = { id: id(), amount: Number(automationAction.config.amount || 0), basisAmount: Number(automationAction.config.basisAmount || automationAction.config.amount || 0), rate: Number(automationAction.config.rate || 0.18), sourceType: "manual" as const, sourceId: run.id, status: "reserved" as const, createdAt: now(), notes: "Automation tax reserve movement.", audit: [`${now()}: Automation reserve movement.`] }; data.taxReserveMovements.unshift(movement); step.linkedRecords.push({ type: "tax_reserve", id: movement.id, href: "/finance" }); }
function createFinanceReview(data: OperatingData, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { const task = { id: id(), title: String(automationAction.config.title || "Finance automation review"), status: "open" as const, priority: "high" as const, entityType: "automation_run", entityId: run.id, createdAt: now() }; data.tasks.unshift(task); step.linkedRecords.push({ type: "task", id: task.id, href: "/finance" }); }
function simulateReinvestment(data: OperatingData, run: AutomationRun, step: AutomationStep) { data.reinvestmentAllocations ||= []; const allocation = data.reinvestmentAllocations[0] || { id: id(), target: "inventory" as const, percentage: 45, amount: 0, basis: "deployable_cash" as const, approvalHistory: [], createdAt: now() }; allocation.amount = Number(run.eventPayload.deployableCash || 0) * allocation.percentage / 100; allocation.approvalHistory = [...(allocation.approvalHistory || []), `${now()}: Automation simulation from run ${run.id}.`]; if (!data.reinvestmentAllocations.some((entry) => entry.id === allocation.id)) data.reinvestmentAllocations.unshift(allocation); step.linkedRecords.push({ type: "reinvestment_allocation", id: allocation.id, href: "/finance" }); }
function runSavedReport(data: OperatingData, run: AutomationRun, step: AutomationStep) { const report = data.analyticsSavedReports?.[0]; if (!report) throw new Error("Create a saved analytics report before automation can run it."); const result = recordAnalyticsReportRun(data, report.id, {}, 1); step.linkedRecords.push({ type: "analytics_report_run", id: result.id, href: "/analytics" }); trace(data, run, "info", "Saved analytics report executed.", { reportId: report.id }); }
function refreshForecast(data: OperatingData, run: AutomationRun, step: AutomationStep) { data.forecasts ||= []; const forecast = data.forecasts[0]; if (forecast) { forecast.updatedAt = now(); forecast.assumptions = [...forecast.assumptions, `Automation ${run.id} refreshed forecast assumptions.`]; step.linkedRecords.push({ type: "forecast", id: forecast.id, href: "/finance" }); } else createFinanceReview(data, run, { id: "forecast-review", type: "update_budget_alert", config: { title: "Forecast refresh required" } }, step); }
function requestPoApproval(data: OperatingData, run: AutomationRun, step: AutomationStep) { const po = data.purchaseOrders[0]; if (!po) throw new Error("Purchase order is required before requesting approval."); data.purchaseApprovals ||= []; const approval = data.purchaseApprovals.find((entry) => entry.purchaseOrderId === po.id) || { id: id(), purchaseOrderId: po.id, status: "requested" as const, requestedAt: now(), reason: `Automation ${run.id} requested approval.` }; data.purchaseApprovals.unshift(approval); step.linkedRecords.push({ type: "purchase_approval", id: approval.id, href: "/purchasing" }); }
function updateSupplierLeadTime(data: OperatingData, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { const supplier = data.suppliers[0]; if (!supplier) throw new Error("Supplier is required before updating lead time."); supplier.leadDays = Math.max(1, Number(supplier.leadDays || 0) + Number(automationAction.config.leadTimeDelta || run.eventPayload.leadTimeDelta || 1)); refreshSupplierScorecards(data); step.linkedRecords.push({ type: "supplier", id: supplier.id, href: "/purchasing" }); }
function createTypedTask(data: OperatingData, title: string, entityType: string, entityId: string | undefined, href: string, step: AutomationStep) { const task = { id: id(), title, status: "open" as const, priority: "high" as const, entityType, entityId, createdAt: now() }; data.tasks.unshift(task); step.linkedRecords.push({ type: "task", id: task.id, href }); }
function enqueueJob(data: OperatingData, rule: AutomationRule, run: AutomationRun, automationAction: AutomationAction, step: AutomationStep) { const job = { id: id(), queue: "inventory_risk" as const, status: "queued" as const, attempts: 0, maxAttempts: 3, payload: { action: automationAction.type, ruleId: rule.id, runId: run.id }, runAfter: now(), createdAt: now() }; data.durableJobs ||= []; data.durableJobs.unshift(job); step.linkedRecords.push({ type: "durable_job", id: job.id }); }
function variantFromRun(data: OperatingData, run: AutomationRun) { return data.variants.find((entry) => entry.id === run.eventPayload.variantId || entry.sku === run.eventPayload.sku) || data.variants[0]; }
function balanceFromRun(data: OperatingData, run: AutomationRun) { return data.balances.find((entry) => entry.id === run.eventPayload.balanceId || entry.variantId === run.eventPayload.variantId) || data.balances[0]; }
function orderFromRun(data: OperatingData, run: AutomationRun) { return data.orders.find((entry) => entry.id === run.eventPayload.orderId || entry.number === run.eventPayload.orderNumber) || data.orders[0]; }
function draftFromRun(data: OperatingData, run: AutomationRun) { return data.channelListingDrafts?.find((entry) => entry.id === run.eventPayload.draftId || entry.listingId === run.eventPayload.listingId) || data.channelListingDrafts?.[0]; }
function exhaustiveAction(automationAction: AutomationAction) { throw new Error(`Unsupported automation action: ${JSON.stringify(automationAction)}`); }
function restore(target: OperatingData, source: OperatingData) { for (const key of Object.keys(target) as (keyof OperatingData)[]) delete target[key]; Object.assign(target, source); }

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
