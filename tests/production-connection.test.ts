import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNoServerSecretsInPublicEnv, providerReadiness, readProductionEnv, storageBuckets, validateProductionReadiness } from "../lib/production-config";
import { migrationInventory, productionHealth, workerReadiness } from "../lib/production-health";
import { productionStorageDescriptors, storageReadiness } from "../lib/production-storage";
import type { OperatingData } from "../domain/business";

const baseEnv = {
  FAUST_ENV: "staging",
  NEXT_PUBLIC_FAUST_AUTH_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  AUTOMATION_WORKER_URL: "https://faust.example.test/api/automations/actions",
  STAGING_APP_URL: "https://faust-staging.example.test",
};

test("production environment validation separates local, staging, and production safely", () => {
  const local = validateProductionReadiness(readProductionEnv({ FAUST_ENV: "local", NEXT_PUBLIC_FAUST_AUTH_ENABLED: "false" }));
  assert.equal(local.status, "local_unconfigured");
  const staging = validateProductionReadiness(readProductionEnv(baseEnv));
  assert.equal(staging.status, "ready");
  assert.equal(staging.publicClientConfigured, true);
  assert.throws(() => assertNoServerSecretsInPublicEnv({ NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "bad" }), /Server-only secret/);
  const missing = validateProductionReadiness(readProductionEnv({ FAUST_ENV: "production", NEXT_PUBLIC_FAUST_AUTH_ENABLED: "true" }));
  assert.equal(missing.status, "missing_required");
  assert.ok(missing.missing.includes("NEXT_PUBLIC_SUPABASE_URL"));
  const providerMissing = validateProductionReadiness(readProductionEnv({ ...baseEnv, AI_PROVIDER: "openai", OPENAI_API_KEY: "", SHIPPING_PROVIDER: "easypost", EASYPOST_API_KEY: "" }));
  assert.ok(providerMissing.missing.includes("OPENAI_API_KEY"));
  assert.ok(providerMissing.missing.includes("EASYPOST_API_KEY"));
  const providers = providerReadiness(readProductionEnv({ ...baseEnv, AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test", SHIPPING_PROVIDER: "easypost", EASYPOST_API_KEY: "EZTK-test" }));
  assert.equal(providers.ai.configured, true);
  assert.equal(providers.shipping.configured, true);
  assert.equal(providers.marketplaces.allFiveLiveCredentials, "not_connected_by_design");
});

test("storage descriptors cover every required production artifact boundary", () => {
  const env = readProductionEnv(baseEnv);
  const buckets = storageBuckets(env);
  assert.equal(buckets["extension-screenshots"], "extension-screenshots");
  const descriptors = productionStorageDescriptors(env);
  assert.deepEqual(descriptors.map((item) => item.kind), ["product-image", "receipt", "shipping-label", "packing-photo", "extension-screenshot", "extension-dom-snapshot", "extension-log", "publish-evidence"]);
  const readiness = storageReadiness(env);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.bucketCount, 8);
});

test("migration inventory is ordered and includes the production connection prerequisites", () => {
  const inventory = migrationInventory();
  assert.equal(inventory.ready, true);
  assert.equal(inventory.latest, "024_product_digital_twins.sql");
  assert.ok(inventory.files.includes("001_core_auth_and_tenancy.sql"));
  assert.ok(inventory.files.includes("022_browser_extension_phase2.sql"));
  assert.ok(inventory.files.includes("023_product_image_ownership.sql"));
  assert.ok(inventory.files.includes("024_product_digital_twins.sql"));
});

test("production health reports database, worker, storage, migrations, extension, and provider status", () => {
  const data = { version: 1, mode: "local", updatedAt: new Date().toISOString(), products: [], variants: [], locations: [], balances: [], stockMovements: [], suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [], durableJobs: [{ id: crypto.randomUUID(), queue: "marketplace_publish", status: "queued", attempts: 0, maxAttempts: 3, payload: {}, runAfter: new Date().toISOString(), createdAt: new Date().toISOString() }], deadLetters: [], automationWorkerHeartbeats: [{ id: crypto.randomUUID(), workerId: "test-worker", status: "healthy", concurrency: 4, pollingIntervalMs: 5000, leaseTimeoutMs: 30000, lastBeatAt: new Date().toISOString(), startedAt: new Date().toISOString() }] } satisfies OperatingData;
  const readiness = workerReadiness(readProductionEnv(baseEnv), data);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.queueDepth, 1);
  const health = productionHealth(data);
  assert.ok(["ok", "warning", "blocked"].includes(health.status));
  assert.ok(health.checks.migrations.ready);
  assert.equal(health.checks.providers.marketplaces.allFiveLiveCredentials, "not_connected_by_design");
});
