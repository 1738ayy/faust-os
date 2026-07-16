const endpoint = process.env.AUTOMATION_WORKER_URL || "http://localhost:3000/api/automations/actions";
const workerId = process.env.AUTOMATION_WORKER_ID || `automation-worker-${process.pid}`;
const concurrency = Number(process.env.AUTOMATION_WORKER_CONCURRENCY || 4);
const pollingIntervalMs = Number(process.env.AUTOMATION_WORKER_POLL_MS || 5000);
const leaseTimeoutMs = Number(process.env.AUTOMATION_WORKER_LEASE_MS || 30000);
const browserJobsEnabled = process.env.BROWSER_EXTENSION_WORKER_ENABLED === "true";

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

function log(level, message, detail = {}) {
  process.stdout.write(`${JSON.stringify({ level, message, workerId, time: new Date().toISOString(), ...detail })}\n`);
}

async function tick() {
  const startedAt = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Faust-Worker-Id": workerId },
    body: JSON.stringify({ action: "worker-tick", workerId, concurrency, pollingIntervalMs, leaseTimeoutMs, browserJobsEnabled }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Automation worker tick failed: ${response.status} ${body}`);
  const parsed = body ? JSON.parse(body) : {};
  log("info", "Automation worker tick complete", { durationMs: Date.now() - startedAt, dueCount: parsed.actionResult?.dueCount || 0, runCount: parsed.actionResult?.runs?.length || 0, browserJobsEnabled });
}

log("info", "Automation worker starting", { endpoint, concurrency, pollingIntervalMs, leaseTimeoutMs, browserJobsEnabled, gracefulShutdown: true });
while (!stopping) {
  try {
    await tick();
  } catch (error) {
    log("error", "Automation worker tick failed", { error: error instanceof Error ? error.message : String(error) });
  }
  await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
}
log("info", "Automation worker stopped", { gracefulShutdown: true });
