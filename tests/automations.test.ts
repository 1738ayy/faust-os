import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { approveAutomation, archiveAutomationRule, createAutomationRule, duplicateAutomationRule, ensureAutomationCollections, retryAutomation, runAutomationRule, setAutomationEnabled, testAutomationRule } from "../lib/automations";

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
