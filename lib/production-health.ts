import fs from "node:fs";
import path from "node:path";
import { extensionConnectionSummary } from "./browser-extension";
import { providerReadiness, validateProductionReadiness, readProductionEnv } from "./production-config";
import { storageReadiness } from "./production-storage";
import type { OperatingData } from "../domain/business";

export type HealthStatus = "ok" | "warning" | "blocked";

function statusFrom(ready: boolean, warnings: unknown[] = []): HealthStatus {
  if (!ready) return "blocked";
  return warnings.length ? "warning" : "ok";
}

export function migrationInventory(root = process.cwd()) {
  const dir = path.join(root, "supabase", "migrations");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => /^\d+_.+\.sql$/.test(file)).sort() : [];
  const numbers = files.map((file) => Number(file.slice(0, 3)));
  const conflicts = files.filter((file, index) => files.findIndex((entry) => entry.slice(0, 3) === file.slice(0, 3)) !== index);
  const gaps = numbers.flatMap((value, index) => index === 0 ? [] : numbers[index - 1] + 1 === value ? [] : [`${numbers[index - 1]}→${value}`]);
  return { files, latest: files.at(-1), count: files.length, ordered: files.every((file, index) => index === 0 || files[index - 1] < file), conflicts, gaps, ready: Boolean(files.length) && !conflicts.length && !gaps.length };
}

export function workerReadiness(env = readProductionEnv(), data?: OperatingData) {
  const heartbeats = data?.automationWorkerHeartbeats || [];
  const latest = heartbeats[0];
  const queueDepth = (data?.durableJobs || []).filter((job) => job.status === "queued").length + (data?.automationRetries || []).filter((retry) => retry.status === "scheduled").length;
  const deadLetters = (data?.deadLetters || []).length + (data?.automationDeadLetters || []).filter((entry) => entry.status === "open").length;
  return { ready: Boolean(env.AUTOMATION_WORKER_URL || env.FAUST_ENV === "local"), workerUrlConfigured: Boolean(env.AUTOMATION_WORKER_URL), workerId: env.AUTOMATION_WORKER_ID || "platform-assigned", queueDepth, deadLetters, lastHeartbeatAt: latest?.lastBeatAt, gracefulShutdown: true, structuredLogging: true };
}

export function productionHealth(data?: OperatingData) {
  const env = readProductionEnv();
  const config = validateProductionReadiness(env);
  const migrations = migrationInventory();
  const storage = storageReadiness(env);
  const worker = workerReadiness(env, data);
  const extension = data ? extensionConnectionSummary(data) : undefined;
  const checks = {
    environment: { ...config, status: config.status === "missing_required" ? "blocked" as const : config.warnings.length ? "warning" as const : "ok" as const },
    database: { status: statusFrom(config.publicClientConfigured || env.FAUST_ENV === "local"), supabaseConfigured: config.publicClientConfigured },
    migrations: { status: statusFrom(migrations.ready), ...migrations },
    storage: { status: statusFrom(storage.ready, storage.duplicateBuckets), ...storage },
    worker: { status: statusFrom(worker.ready, worker.deadLetters ? [worker.deadLetters] : []), ...worker },
    extension: { status: "ok" as const, registeredDevices: extension?.devices?.length || 0, activeDevices: extension?.devices?.filter((device) => device.status === "active").length || 0, artifacts: extension?.artifacts?.length || 0 },
    providers: { status: providerReadiness(env).shipping.configured && providerReadiness(env).ai.configured ? "warning" as const : "blocked" as const, ...providerReadiness(env), bankCredentials: "not_connected_by_design" },
  };
  const overall: HealthStatus = Object.values(checks).some((check) => check.status === "blocked") ? "blocked" : Object.values(checks).some((check) => check.status === "warning") ? "warning" : "ok";
  return { ok: overall !== "blocked", status: overall, checkedAt: new Date().toISOString(), checks };
}
