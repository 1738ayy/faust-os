import assert from "node:assert/strict";
import { test } from "node:test";
import { auditMigrations, createSyntheticOperatingData, profileProductionWorkflows, securityAudit, technicalDebtAudit } from "../lib/production-hardening";
import { buildProductExperiences } from "../lib/product-experience";

test("Product Experience generation scales without repeated whole-workspace scans", () => {
  const data = createSyntheticOperatingData(1_000);
  const started = performance.now();
  const experiences = buildProductExperiences(data);
  const durationMs = performance.now() - started;
  assert.equal(experiences.length, 1_000);
  assert.ok(durationMs < 1_500, `1,000 Product Experiences should build quickly; observed ${Math.round(durationMs)}ms`);
});

test("production hardening profile covers import, knowledge, pipeline, drafts, publishing, automation, and serialization", () => {
  const profile = profileProductionWorkflows(1_000);
  const labels = profile.profiles.map((entry) => entry.label);
  for (const expected of ["Product import latency", "Product Knowledge generation", "Pipeline updates", "Action Center state sync", "Draft generation", "Marketplace publish path", "Automation execution", "Repository serialization"]) {
    assert.ok(labels.includes(expected), `${expected} profile missing`);
  }
  const slow = profile.profiles.filter((entry) => entry.durationMs > 5_000);
  assert.deepEqual(slow, []);
  assert.ok(profile.heapUsedMb > 0);
});

test("migration audit tracks indexes, RLS, foreign keys, and schema cache reloads", () => {
  const audit = auditMigrations();
  assert.ok(audit.fileCount >= 35);
  assert.equal(audit.latest, "035_intelligence_observability_studio.sql");
  assert.ok(!audit.missingRls.includes("035_intelligence_observability_studio.sql"));
  assert.ok(!audit.missingNotify.includes("035_intelligence_observability_studio.sql"));
  assert.ok(!audit.destructiveStatements.includes("035_intelligence_observability_studio.sql"));
});

test("security and technical debt audits catch public secret leaks and operational drift", () => {
  const security = securityAudit();
  assert.deepEqual(security.publicSecretLeaks, []);
  assert.deepEqual(security.unsafeLogs, []);
  assert.ok(security.validationRoutesChecked >= 10);
  assert.ok(security.rlsTablesChecked >= 20);
  const debt = technicalDebtAudit();
  assert.ok(Array.isArray(debt.actionMarkers));
  assert.ok(Array.isArray(debt.legacyMarkers));
});
