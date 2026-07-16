import type { AutomationAction, AutomationCondition, AutomationDeadLetter, AutomationIdempotencyReceipt, AutomationRule, AutomationRun, AutomationStep, AutomationTemplate, AutomationTriggerType, OperatingData } from "@/domain/business";
import { availableUnits } from "./business-calculations";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

export type AutomationMutationInput = { ruleId?: string; runId?: string; stepId?: string; templateId?: string; idempotencyKey?: string; name?: string; triggerType?: AutomationTriggerType; dryRun?: boolean; enabled?: boolean; priority?: number; conditionMode?: "AND" | "OR"; samplePayload?: Record<string, unknown> };

const condition = (field: string, operator: AutomationCondition["operator"], value?: AutomationCondition["value"]): AutomationCondition => ({ id: id(), field, operator, value });
const action = (type: AutomationAction["type"], config: AutomationAction["config"] = {}, flags: Partial<AutomationAction> = {}): AutomationAction => ({ id: id(), type, config, ...flags });

export function defaultAutomationTemplates(createdAt = now()): AutomationTemplate[] {
  return [
    { id: "auto-template-low-stock", name: "Low stock → reorder recommendation", description: "Creates a reorder recommendation and alert when available stock reaches reorder point.", triggerType: "inventory.stock_below_reorder_point", conditions: [condition("available", "less_or_equal", 2)], actions: [action("create_reorder_recommendation"), action("create_notification")], approvalRequired: false, createdAt },
    { id: "auto-template-listing-sync", name: "Failed listing sync → retry + alert + risk lock", description: "Retries failed sync, alerts operators, and locks risky stock.", triggerType: "listings.quantity_sync_failed", conditions: [condition("status", "equals", "failed")], actions: [action("queue_quantity_sync"), action("place_sku_risk_lock"), action("create_notification")], approvalRequired: false, createdAt },
    { id: "auto-template-sale-delist", name: "Sale → sibling delist queue", description: "Queues sibling delist coordination after a sale.", triggerType: "orders.payment_received", conditions: [condition("marketplace", "exists")], actions: [action("queue_sibling_delist")], approvalRequired: false, createdAt },
    { id: "auto-template-ship-deadline", name: "Shipping deadline approaching → priority alert", description: "Creates a critical task and notification before SLA risk.", triggerType: "orders.shipping_deadline_approaching", conditions: [condition("hoursUntilDeadline", "less_or_equal", 24)], actions: [action("create_task"), action("create_notification")], approvalRequired: false, createdAt },
    { id: "auto-template-tracking-stalled", name: "Tracking stalled → fulfillment exception", description: "Creates a fulfillment exception for stale tracking.", triggerType: "fulfillment.tracking_stalled", conditions: [condition("hoursSinceScan", "greater_or_equal", 72)], actions: [action("create_fulfillment_exception")], approvalRequired: false, createdAt },
    { id: "auto-template-negative-margin", name: "Negative margin order → Finance alert", description: "Raises a Finance alert when contribution profit is below zero.", triggerType: "finance.negative_margin_detected", conditions: [condition("contributionProfit", "less_than", 0)], actions: [action("create_notification")], approvalRequired: false, createdAt },
    { id: "auto-template-payout-discrepancy", name: "Payout discrepancy → reconciliation task", description: "Creates a task for payout reconciliation discrepancies.", triggerType: "finance.payout_discrepancy", conditions: [condition("discrepancy", "not_equals", 0)], actions: [action("create_task")], approvalRequired: false, createdAt },
    { id: "auto-template-dead-stock", name: "Dead stock → analytics report + recommendation", description: "Runs the dead-stock report and creates a markdown recommendation boundary.", triggerType: "analytics.dead_stock_detected", conditions: [condition("daysWithoutSale", "greater_or_equal", 60)], actions: [action("run_saved_report"), action("create_notification")], approvalRequired: false, createdAt },
    { id: "auto-template-supplier-delay", name: "Supplier delay → update reorder point + alert", description: "Alerts operators when lead time worsens and creates a review task.", triggerType: "purchasing.supplier_lead_time_worsens", conditions: [condition("leadTimeDelta", "greater_than", 3)], actions: [action("create_task"), action("create_notification")], approvalRequired: false, createdAt },
    { id: "auto-template-cash-threshold", name: "Deployable cash threshold → reinvestment recommendation", description: "Creates an approval-gated reinvestment recommendation when deployable cash exceeds threshold.", triggerType: "finance.deployable_cash_above_threshold", conditions: [condition("deployableCash", "greater_or_equal", 500)], actions: [action("request_approval", {}, { approvalRequired: true }), action("create_task")], approvalRequired: true, createdAt },
  ];
}

export function ensureAutomationCollections(data: OperatingData) {
  data.automationRules ||= [];
  data.automationRuns ||= [];
  data.automationSteps ||= [];
  data.automationApprovals ||= [];
  data.automationRetries ||= [];
  data.automationDeadLetters ||= [];
  data.automationTemplates ||= defaultAutomationTemplates();
  data.automationIdempotencyReceipts ||= [];
}

export function createAutomationRule(data: OperatingData, input: AutomationMutationInput = {}) {
  ensureAutomationCollections(data);
  const createdAt = now();
  const template = input.templateId ? data.automationTemplates!.find((entry) => entry.id === input.templateId) : undefined;
  const triggerType = input.triggerType || template?.triggerType || "inventory.stock_below_reorder_point";
  const rule: AutomationRule = {
    id: id(),
    name: input.name || template?.name || "Low stock reorder guard",
    description: template?.description || "Event-driven automation rule.",
    enabled: input.enabled ?? false,
    owner: "system",
    priority: input.priority || 50,
    trigger: { type: triggerType, samplePayload: input.samplePayload || sampleEventFor(data, triggerType) },
    conditionMode: input.conditionMode || "AND",
    conditions: template?.conditions.map((entry) => ({ ...entry, id: id() })) || [condition("available", "less_or_equal", 2)],
    actions: template?.actions.map((entry) => ({ ...entry, id: id() })) || [action("create_notification"), action("create_reorder_recommendation")],
    schedule: { id: id(), frequency: "daily", timezone: "America/New_York", businessHoursOnly: true, nextRunAt: nextRun("daily"), createdAt },
    approvalRequired: template?.approvalRequired || false,
    approverRole: template?.approvalRequired ? "admin" : undefined,
    dryRun: input.dryRun ?? true,
    nextRunAt: nextRun("daily"),
    runCount: 0,
    failureCount: 0,
    createdAt,
    updatedAt: createdAt,
  };
  data.automationRules!.unshift(rule);
  audit(data, "Automation rule created", "automation_rule", rule.id, `${rule.name} listens for ${rule.trigger.type}.`);
  return rule;
}

export function duplicateAutomationRule(data: OperatingData, ruleId: string) {
  ensureAutomationCollections(data);
  const source = rule(data, ruleId);
  const copy = createAutomationRule(data, { name: nextCopyName(data, source.name), triggerType: source.trigger.type, dryRun: source.dryRun, enabled: false, priority: source.priority, conditionMode: source.conditionMode, samplePayload: source.trigger.samplePayload });
  copy.conditions = source.conditions.map((entry) => ({ ...entry, id: id() }));
  copy.actions = source.actions.map((entry) => ({ ...entry, id: id() }));
  copy.approvalRequired = source.approvalRequired;
  copy.approverRole = source.approverRole;
  return copy;
}

export function setAutomationEnabled(data: OperatingData, ruleId: string, enabled: boolean) {
  const entry = rule(data, ruleId);
  entry.enabled = enabled; entry.updatedAt = now();
  audit(data, enabled ? "Automation enabled" : "Automation disabled", "automation_rule", entry.id, entry.name);
  return entry;
}

export function archiveAutomationRule(data: OperatingData, ruleId: string) {
  const entry = rule(data, ruleId);
  entry.enabled = false; entry.archivedAt = now(); entry.updatedAt = now();
  audit(data, "Automation archived", "automation_rule", entry.id, entry.name);
  return entry;
}

export function runAutomationRule(data: OperatingData, ruleId: string, payload?: Record<string, unknown>, idempotencyKey = `${ruleId}:${JSON.stringify(payload || {})}`) {
  ensureAutomationCollections(data);
  const entry = rule(data, ruleId);
  if (!entry.enabled && !entry.dryRun) throw new Error("Automation rule is disabled.");
  const existing = data.automationIdempotencyReceipts!.find((receipt) => receipt.key === idempotencyKey);
  if (existing) return data.automationRuns!.find((run) => run.id === existing.runId)!;
  const started = Date.now();
  const eventPayload = payload || entry.trigger.samplePayload || sampleEventFor(data, entry.trigger.type);
  const conditionResults = evaluateConditions(entry.conditions, eventPayload, data);
  const passes = entry.conditionMode === "AND" ? conditionResults.every((item) => item.result) : conditionResults.some((item) => item.result);
  const run: AutomationRun = { id: id(), ruleId: entry.id, triggerType: entry.trigger.type, status: entry.dryRun ? "dry_run" : "running", idempotencyKey, eventPayload, conditionResults, stepIds: [], createdAt: now(), startedAt: now() };
  data.automationRuns!.unshift(run);
  receipt(data, idempotencyKey, entry.id, run.id);
  if (!passes) {
    const step = stepFor(run.id, "Conditions did not match", "skipped");
    data.automationSteps!.unshift(step); run.stepIds.push(step.id); finishRun(data, entry, run, "succeeded", started);
    return run;
  }
  for (const automationAction of entry.actions) {
    const requiresApproval = !entry.dryRun && (automationAction.approvalRequired || entry.approvalRequired);
    const step = stepFor(run.id, automationAction.type.replaceAll("_", " "), requiresApproval ? "waiting_approval" : "running", automationAction.id);
    data.automationSteps!.unshift(step); run.stepIds.push(step.id);
    if (step.status === "waiting_approval") { approval(data, entry, run, automationAction); run.status = "waiting_approval"; continue; }
    executeAction(data, entry, run, step, automationAction);
  }
  if (run.status !== "waiting_approval") finishRun(data, entry, run, entry.dryRun ? "dry_run" : "succeeded", started);
  return run;
}

export function approveAutomation(data: OperatingData, approvalId: string, approved: boolean) {
  ensureAutomationCollections(data);
  const entry = data.automationApprovals!.find((item) => item.id === approvalId);
  if (!entry) throw new Error("Automation approval not found.");
  entry.status = approved ? "approved" : "rejected"; entry.decidedAt = now(); entry.decisionBy = "local-admin"; entry.history.push(`${entry.decidedAt}: ${entry.status}`);
  const step = data.automationSteps!.find((item) => item.runId === entry.runId && item.actionId === entry.actionId);
  if (step) { step.status = approved ? "succeeded" : "cancelled"; step.finishedAt = now(); step.logs.push(approved ? "Approved and completed." : "Rejected by approver."); }
  const run = data.automationRuns!.find((item) => item.id === entry.runId);
  const sourceRule = run ? data.automationRules!.find((item) => item.id === run.ruleId) : undefined;
  if (run && sourceRule) finishRun(data, sourceRule, run, approved ? "succeeded" : "cancelled", Date.now());
  return entry;
}

export function retryAutomation(data: OperatingData, runId: string) {
  ensureAutomationCollections(data);
  const failed = data.automationRuns!.find((run) => run.id === runId);
  if (!failed) throw new Error("Automation run not found.");
  const retry = { id: id(), runId, attempt: (data.automationRetries!.filter((entry) => entry.runId === runId).length + 1), runAfter: nextBackoff(1), status: "scheduled" as const, createdAt: now() };
  data.automationRetries!.unshift(retry);
  const dead = data.automationDeadLetters!.find((entry) => entry.runId === runId && entry.status === "open");
  if (dead) dead.status = "retried";
  return runAutomationRule(data, failed.ruleId, failed.eventPayload, `${failed.id}:retry:${retry.attempt}`);
}

export function cancelAutomationRun(data: OperatingData, runId: string) {
  const run = data.automationRuns?.find((entry) => entry.id === runId);
  if (!run) throw new Error("Automation run not found.");
  run.status = "cancelled"; run.finishedAt = now();
  return run;
}

export function testAutomationRule(data: OperatingData, ruleId: string) {
  const entry = rule(data, ruleId);
  const originalDryRun = entry.dryRun;
  entry.dryRun = true;
  const run = runAutomationRule(data, ruleId, entry.trigger.samplePayload, `${ruleId}:test:${Date.now()}`);
  entry.dryRun = originalDryRun;
  return run;
}

function evaluateConditions(conditions: AutomationCondition[], payload: Record<string, unknown>, data: OperatingData) {
  return conditions.map((entry) => ({ ...entry, result: evaluateCondition(entry, valueAt(entry.field, payload, data)) }));
}

function evaluateCondition(condition: AutomationCondition, actual: unknown) {
  const expected = condition.value;
  if (condition.operator === "exists") return actual !== undefined && actual !== null && actual !== "";
  if (condition.operator === "does_not_exist") return actual === undefined || actual === null || actual === "";
  if (condition.operator === "equals") return actual === expected;
  if (condition.operator === "not_equals") return actual !== expected;
  if (condition.operator === "contains") return String(actual ?? "").includes(String(expected ?? ""));
  if (condition.operator === "does_not_contain") return !String(actual ?? "").includes(String(expected ?? ""));
  if (condition.operator === "in_list") return Array.isArray(expected) && expected.includes(String(actual));
  if (condition.operator === "not_in_list") return Array.isArray(expected) && !expected.includes(String(actual));
  const actualNumber = Number(actual || 0), expectedNumber = Number(expected || 0);
  if (condition.operator === "greater_than") return actualNumber > expectedNumber;
  if (condition.operator === "less_than") return actualNumber < expectedNumber;
  if (condition.operator === "greater_or_equal") return actualNumber >= expectedNumber;
  if (condition.operator === "less_or_equal") return actualNumber <= expectedNumber;
  if (condition.operator === "age_exceeds") return actualNumber >= expectedNumber;
  if (condition.operator === "percentage_change_exceeds") return Math.abs(actualNumber) >= expectedNumber;
  if (condition.operator === "date_time_window") return true;
  return false;
}

function executeAction(data: OperatingData, rule: AutomationRule, run: AutomationRun, step: AutomationStep, automationAction: AutomationAction) {
  try {
    if (rule.dryRun) { step.status = "succeeded"; step.logs.push("Dry run: action was evaluated but not persisted."); return; }
    if (automationAction.type === "create_notification") {
      const notice = { id: id(), severity: "warning" as const, title: automationAction.config.title ? String(automationAction.config.title) : rule.name, detail: `Automation ${rule.name} triggered.`, actionLabel: "Review automation", href: "/automations", createdAt: now(), category: "system" as const, entityType: "automation_rule", entityId: rule.id, read: false };
      data.notices.unshift(notice); step.linkedRecords.push({ type: "notification", id: notice.id, href: "/automations" });
    } else if (automationAction.type === "create_task" || automationAction.type === "request_approval") {
      const task = { id: id(), title: automationAction.config.title ? String(automationAction.config.title) : `Automation follow-up: ${rule.name}`, status: "open" as const, priority: "high" as const, entityType: "automation_rule", entityId: rule.id, createdAt: now() };
      data.tasks.unshift(task); step.linkedRecords.push({ type: "task", id: task.id, href: "/tasks" });
    } else if (automationAction.type === "create_reorder_recommendation") {
      const variant = data.variants[0]; const balance = variant ? data.balances.find((entry) => entry.variantId === variant.id) : undefined;
      if (variant) { const rec = { id: id(), variantId: variant.id, supplierId: data.products.find((product) => product.id === variant.productId)?.supplierId, recommendedQuantity: variant.reorderQuantity, reorderPoint: variant.reorderPoint, safetyStock: Math.ceil(variant.reorderQuantity / 2), available: balance ? availableUnits(balance) : 0, incoming: balance?.incoming || 0, velocity30d: 1, estimatedCostUsd: variant.reorderQuantity * variant.landedUnitCost, status: "open" as const, createdAt: now() }; data.reorderRecommendations ||= []; data.reorderRecommendations.unshift(rec); step.linkedRecords.push({ type: "reorder_recommendation", id: rec.id, href: "/purchasing" }); }
    } else if (automationAction.type === "place_sku_risk_lock") {
      const variant = data.variants[0]; if (variant) { data.inventoryRiskLocks ||= []; const lock = { id: id(), variantId: variant.id, reason: "manual_hold" as const, status: "active" as const, lockedQuantity: 1, createdAt: now(), notes: `Automation ${rule.name}` }; data.inventoryRiskLocks.unshift(lock); step.linkedRecords.push({ type: "inventory_risk_lock", id: lock.id, href: "/listings" }); }
    } else if (automationAction.type === "queue_quantity_sync" || automationAction.type === "queue_sibling_delist") {
      const event = { id: id(), topic: "channel.inventory.sync_requested" as const, aggregateType: "automation_rule", aggregateId: rule.id, payload: { action: automationAction.type, runId: run.id }, status: "pending" as const, attempts: 0, createdAt: now() }; data.outboxEvents ||= []; data.outboxEvents.unshift(event); step.linkedRecords.push({ type: "outbox_event", id: event.id });
    } else {
      const job = { id: id(), queue: "inventory_risk" as const, status: "queued" as const, attempts: 0, maxAttempts: 3, payload: { action: automationAction.type, ruleId: rule.id, runId: run.id }, runAfter: now(), createdAt: now() };
      data.durableJobs ||= []; data.durableJobs.unshift(job); step.linkedRecords.push({ type: "durable_job", id: job.id });
    }
    step.status = "succeeded"; step.finishedAt = now(); step.logs.push("Action completed.");
    audit(data, "Automation action executed", "automation_run", run.id, `${automationAction.type} completed.`);
  } catch (error) {
    step.status = "failed"; step.error = error instanceof Error ? error.message : "Automation action failed."; step.finishedAt = now();
    run.status = "failed"; run.error = step.error;
    deadLetter(data, run, rule, step.error);
  }
}

function sampleEventFor(data: OperatingData, type: AutomationTriggerType) {
  const variant = data.variants[0], balance = variant ? data.balances.find((entry) => entry.variantId === variant.id) : undefined;
  return { triggerType: type, sku: variant?.sku || "FST-HOOD-001", available: balance ? availableUnits(balance) : 0, reorderPoint: variant?.reorderPoint || 2, marketplace: data.orders[0]?.marketplace || "Depop", status: "failed", deployableCash: 600, contributionProfit: -1, hoursUntilDeadline: 12 };
}

function valueAt(field: string, payload: Record<string, unknown>, data: OperatingData) {
  if (field in payload) return payload[field];
  if (field === "available") { const variant = data.variants[0]; const balance = variant ? data.balances.find((entry) => entry.variantId === variant.id) : undefined; return balance ? availableUnits(balance) : 0; }
  return undefined;
}

function nextRun(frequency: string) { const date = new Date(); date.setHours(date.getHours() + (frequency === "hourly" ? 1 : 24)); return date.toISOString(); }
function nextBackoff(attempt: number) { const date = new Date(); date.setMinutes(date.getMinutes() + Math.min(60, 2 ** attempt)); return date.toISOString(); }
function stepFor(runId: string, label: string, status: AutomationStep["status"], actionId?: string): AutomationStep { return { id: id(), runId, actionId, label, status, attempts: 1, maxAttempts: 3, startedAt: now(), logs: [], linkedRecords: [] }; }
function finishRun(data: OperatingData, rule: AutomationRule, run: AutomationRun, status: AutomationRun["status"], started: number) { run.status = status; run.finishedAt = now(); run.durationMs = Date.now() - started; rule.lastRunAt = run.finishedAt; rule.runCount += 1; if (status === "failed" || status === "dead_lettered") rule.failureCount += 1; audit(data, "Automation run finished", "automation_run", run.id, `${rule.name}: ${status}`); }
function audit(data: OperatingData, action: string, entityType: string, entityId: string, detail: string) { data.activity.unshift({ id: id(), action, entityType, entityId, detail, createdAt: now() }); }
function receipt(data: OperatingData, key: string, ruleId: string, runId: string): AutomationIdempotencyReceipt { const entry = { id: id(), key, ruleId, runId, createdAt: now() }; data.automationIdempotencyReceipts!.unshift(entry); return entry; }
function approval(data: OperatingData, rule: AutomationRule, run: AutomationRun, automationAction: AutomationAction) { data.automationApprovals!.unshift({ id: id(), ruleId: rule.id, runId: run.id, actionId: automationAction.id, status: "pending", approverRole: rule.approverRole || "admin", requestedAt: now(), history: [`${now()}: Approval requested for ${automationAction.type}.`] }); }
function deadLetter(data: OperatingData, run: AutomationRun, rule: AutomationRule, reason = "Automation failed"): AutomationDeadLetter { const entry = { id: id(), runId: run.id, ruleId: rule.id, reason, payload: run.eventPayload, status: "open" as const, createdAt: now() }; data.automationDeadLetters!.unshift(entry); return entry; }
function rule(data: OperatingData, ruleId: string) { ensureAutomationCollections(data); const entry = data.automationRules!.find((item) => item.id === ruleId); if (!entry) throw new Error("Automation rule not found."); return entry; }
function nextCopyName(data: OperatingData, sourceName: string) { const names = new Set((data.automationRules || []).map((entry) => entry.name)); const base = `${sourceName} copy`; if (!names.has(base)) return base; for (let index = 2; ; index += 1) { const candidate = `${base} ${index}`; if (!names.has(candidate)) return candidate; } }
