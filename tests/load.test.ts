import assert from "node:assert/strict";
import { test } from "node:test";
import { createSyntheticOperatingData, profileProductionWorkflows } from "../lib/production-hardening";

test("load harness simulates 1,000 Product operating workload", () => {
  const profile = profileProductionWorkflows(1_000);
  assert.equal(profile.productCount, 1_000);
  assert.ok(profile.profiles.every((entry) => Number.isFinite(entry.durationMs)));
});

test("load harness simulates 10,000 Product catalog hydration without exhausting memory", () => {
  const profile = profileProductionWorkflows(10_000);
  assert.equal(profile.productCount, 10_000);
  assert.ok(profile.heapUsedMb < 768, `10,000 Product profile used ${profile.heapUsedMb}MB heap`);
});

test("100,000 Product repository payload can be generated for capacity planning", () => {
  const data = createSyntheticOperatingData(100_000);
  assert.equal(data.products.length, 100_000);
  assert.equal(data.variants.length, 100_000);
  assert.equal(data.balances.length, 100_000);
});
