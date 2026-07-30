import assert from "node:assert/strict";
import { test } from "node:test";

import { ensureDailyOperationsCollections, productionOperationsMetrics, recordDogfoodingSession, recordOperationsFeedback } from "../lib/daily-operations";
import { productionErrorPayload, redactOperationalContext } from "../lib/production-logging";
import { createSyntheticOperatingData } from "../lib/production-hardening";

test("daily operations collections initialize on existing operating data", () => {
  const data = createSyntheticOperatingData(3);
  delete data.operationsFeedback;
  delete data.dogfoodingSessions;
  ensureDailyOperationsCollections(data);
  assert.deepEqual(data.operationsFeedback, []);
  assert.deepEqual(data.dogfoodingSessions, []);
});

test("dogfooding feedback escalates repeated workflow friction without duplicating records", () => {
  const data = createSyntheticOperatingData(1);
  const first = recordOperationsFeedback(data, { type: "workflow_friction", severity: "medium", workflow: "Import queue", title: "Selection jumps back to first product", timeLostMinutes: 4 });
  const second = recordOperationsFeedback(data, { type: "bug", severity: "high", workflow: "Import queue", title: "Selection jumps back to first product", timeLostMinutes: 8 });
  assert.equal(first.id, second.id);
  assert.equal(data.operationsFeedback!.length, 1);
  assert.equal(second.severity, "high");
  assert.equal(second.frequency, 2);
  assert.equal(second.timeLostMinutes, 8);
});

test("production operations metrics surface RC blockers and dogfooding throughput", () => {
  const data = createSyntheticOperatingData(5);
  recordDogfoodingSession(data, { date: "2026-07-29", productsImported: 12, reviewTimeMinutes: 24, publishingTimeMinutes: 18, correctionsMade: 7, automationActions: 5, failuresEncountered: 1, uiFrictionCount: 2 });
  recordOperationsFeedback(data, { type: "bug", severity: "critical", workflow: "Publish", title: "Publish can partially complete without confirmation" });
  const metrics = productionOperationsMetrics(data);
  assert.equal(metrics.releaseCandidate.ready, false);
  assert.ok(metrics.releaseCandidate.blockers >= 1);
  assert.equal(metrics.dogfooding.totals.imported, 12);
  assert.equal(metrics.metrics.reviewTimeMinutes, 2);
});

test("production logging redacts secrets while preserving correlation IDs", () => {
  const redacted = redactOperationalContext({ nested: { apiKey: "sk-live", token: "secret", workflow: "Publish" }, count: 2 }) as Record<string, unknown>;
  assert.deepEqual(redacted, { nested: { apiKey: "[redacted]", token: "[redacted]", workflow: "Publish" }, count: 2 });
  const payload = productionErrorPayload(new Error("Boom"), { authorization: "Bearer secret", route: "/api/test" });
  assert.equal(payload.ok, false);
  assert.match(payload.correlationId, /^err-/);
  assert.equal((payload.context as Record<string, unknown>).authorization, "[redacted]");
});
