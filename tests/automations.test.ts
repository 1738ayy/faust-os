import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { approveAutomation, archiveAutomationRule, createAutomationRule, defaultAutomationTemplates, dueScheduledRules, duplicateAutomationRule, ensureAutomationCollections, expireApprovals, ingestAutomationEvent, nextBackoff, processAutomationWorkerTick, recoverStaleRuns, replayDeadLetter, retryAutomation, runAutomationRule, setAutomationEnabled, setSchedulePaused, testAutomationRule } from "../lib/automations";

const fixture = (): OperatingData => {
  const now = "2026-07-01T00:00:00.000Z";
  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  return {
    version: 1, mode: "local", updatedAt: now,
    products: [{ id: productId, title: "Automation hoodie", category: "Streetwear", tags: [], status: "active", createdAt: now, updatedAt: now }],
    variants: [{ id: variantId, productId, sku: "AUTO-HOOD", title: "Automation Hoodie", condition: "New", landedUnitCost: 20, defaultSalePrice: 80, reorderPoint: 2, reorderQuantity: 6, active: true }],
    locations: [], balances: [{ id: crypto.randomUUID(), variantId, onHand: 2, reserved: 1, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 }], stockMovements: [],
    suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [],
  };
};

test("automations create rules, evaluate AND/OR conditions, run actions, and preserve idempotency", () => {
  const data = fixture();
  ensureAutomationCollections(data);
  const rule = createAutomationRule(data, { name: "Low stock reorder automation", enabled: true, dryRun: false });
  assert.equal(rule.conditions[0].operator, "less_or_equal");
  const run = runAutomationRule(data, rule.id, { available: 1, reorderPoint: 2 }, "auto-idempotency-1");
  assert.equal(run.status, "succeeded");
  assert.equal(data.automationSteps?.length, 2);
  assert.equal(data.notices.length, 1);
  assert.equal(data.reorderRecommendations?.length, 1);
  const second = runAutomationRule(data, rule.id, { available: 1, reorderPoint: 2 }, "auto-idempotency-1");
  assert.equal(second.id, run.id);
  rule.conditionMode = "OR";
  rule.conditions.push({ id: crypto.randomUUID(), field: "sku", operator: "equals", value: "MISSING" });
  const orRun = runAutomationRule(data, rule.id, { available: 1, sku: "AUTO-HOOD" }, "auto-idempotency-2");
  assert.equal(orRun.status, "succeeded");
});

test("automations support dry run, approval gates, retry records, duplicate, archive, and disable", () => {
  const data = fixture();
  const rule = createAutomationRule(data, { templateId: "auto-template-cash-threshold", enabled: true, dryRun: false });
  const run = runAutomationRule(data, rule.id, { deployableCash: 1000 }, "approval-run");
  assert.equal(run.status, "waiting_approval");
  assert.equal(data.automationApprovals?.[0].status, "pending");
  const approval = approveAutomation(data, data.automationApprovals![0].id, true);
  assert.equal(approval.status, "approved");
  const dry = testAutomationRule(data, rule.id);
  assert.equal(dry.status, "dry_run");
  data.automationRuns![0].status = "failed";
  const retry = retryAutomation(data, data.automationRuns![0].id);
  assert.ok(data.automationRetries?.length);
  assert.ok(retry.id);
  const copy = duplicateAutomationRule(data, rule.id);
  assert.equal(copy.name, `${rule.name} copy`);
  setAutomationEnabled(data, copy.id, false);
  assert.equal(data.automationRules?.find((entry) => entry.id === copy.id)?.enabled, false);
  archiveAutomationRule(data, copy.id);
  assert.ok(data.automationRules?.find((entry) => entry.id === copy.id)?.archivedAt);
});

test("automations expose production Faust templates and editable schedule controls", () => {
  const data = fixture();
  ensureAutomationCollections(data);
  const templates = defaultAutomationTemplates("2026-07-01T00:00:00.000Z");
  assert.equal(templates.length, 10);
  assert.ok(templates.some((template) => template.triggerType === "listing.quantity_sync_failed"));
  assert.ok(templates.every((template) => template.version === 2));
  const rule = createAutomationRule(data, { templateId: "auto-template-low-stock", enabled: true, dryRun: true, threshold: 4 });
  assert.equal(rule.templateVersion, 2);
  assert.deepEqual(rule.localOverrides, ["threshold"]);
  setSchedulePaused(data, rule.id, true);
  assert.equal(dueScheduledRules(data, new Date(Date.now() + 2 * 86400000).toISOString()).length, 0);
  setSchedulePaused(data, rule.id, false);
  rule.schedule!.nextRunAt = "2026-07-01T00:00:00.000Z";
  assert.equal(dueScheduledRules(data, "2026-07-01T00:00:01.000Z").length, 1);
});

test("automations ingest real Faust events once and create linked runs", () => {
  const data = fixture();
  ensureAutomationCollections(data);
  const rule = createAutomationRule(data, { templateId: "auto-template-low-stock", enabled: true, dryRun: false });
  const receipt = ingestAutomationEvent(data, "inventory.below_reorder_point", { id: "evt-1", aggregateType: "variant", aggregateId: data.variants[0].id, available: 1, reorderPoint: 2 }, "evt-key-1");
  assert.equal(receipt.status, "processed");
  assert.equal(receipt.runIds.length, 1);
  const duplicate = ingestAutomationEvent(data, "inventory.below_reorder_point", { id: "evt-1", available: 1 }, "evt-key-1");
  assert.equal(duplicate.id, receipt.id);
  assert.equal(data.automationRuns?.filter((run) => run.ruleId === rule.id).length, 1);
  assert.ok(data.automationExecutionTraces?.some((trace) => trace.message === "Automation run started"));
});

test("automation worker ticks lease schedules, heartbeat, and recover stale runs", () => {
  const data = fixture();
  ensureAutomationCollections(data);
  const rule = createAutomationRule(data, { enabled: true, dryRun: false });
  rule.schedule!.nextRunAt = "2026-07-01T00:00:00.000Z";
  const result = processAutomationWorkerTick(data, { workerId: "unit-worker", now: "2026-07-01T00:00:01.000Z", concurrency: 1, leaseTimeoutMs: 1000 });
  assert.equal(result.dueCount, 1);
  assert.equal(result.heartbeat.workerId, "unit-worker");
  assert.ok(data.automationWorkerLeases?.some((lease) => lease.resourceType === "schedule" && lease.resourceId === rule.id));
  const running = runAutomationRule(data, rule.id, { available: 1, reorderPoint: 2 }, "stale-run", "unit-worker");
  running.status = "running";
  running.startedAt = "2026-06-30T00:00:00.000Z";
  const recovered = recoverStaleRuns(data, "2026-07-01T00:00:00.000Z", 1000);
  assert.equal(recovered.length, 1);
  assert.equal(data.automationDeadLetters?.[0].status, "open");
});

test("automation retry, dead-letter replay, approval expiration, and backoff are durable", () => {
  const data = fixture();
  ensureAutomationCollections(data);
  const rule = createAutomationRule(data, { templateId: "auto-template-cash-threshold", enabled: true, dryRun: false });
  const run = runAutomationRule(data, rule.id, { deployableCash: 1000 }, "approval-expire");
  assert.equal(run.status, "waiting_approval");
  data.automationApprovals![0].expiresAt = "2026-07-01T00:00:00.000Z";
  const expired = expireApprovals(data, "2026-07-02T00:00:00.000Z");
  assert.equal(expired[0].status, "expired");
  run.status = "failed";
  run.error = "forced failure";
  data.automationDeadLetters!.unshift({ id: crypto.randomUUID(), runId: run.id, ruleId: rule.id, reason: "forced failure", payload: run.eventPayload, status: "open", createdAt: "2026-07-02T00:00:00.000Z" });
  const retry = retryAutomation(data, run.id);
  assert.ok(retry.id);
  const replay = replayDeadLetter(data, data.automationDeadLetters![0].id);
  assert.ok(replay.id);
  assert.ok(new Date(nextBackoff(2)).getTime() > Date.now());
});
