import { automationActionSchema } from "@/lib/validation/requests";
import { getOperatingData, mutateAutomation, snapshot } from "@/services/operating-system/repository";
import type { AutomationMutationInput } from "@/lib/automations";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const data = await getOperatingData();
  return Response.json({ ok: true, data, snapshot: snapshot(data) });
}

export async function POST(request: Request) {
  try {
    const input = automationActionSchema.parse(await request.json());
    if (input.action === "worker-tick" && request.headers.get("X-Faust-Worker-Id") === process.env.AUTOMATION_WORKER_ID) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const businessId = process.env.FAUST_WORKER_BUSINESS_ID;
      if (!url || !serviceKey || !businessId) throw new Error("Worker environment is not fully configured.");
      const client = createClient(url, serviceKey, { auth: { persistSession: false } });
      const { data, error } = await client.from("automation_worker_heartbeats").insert({
        business_id: businessId,
        worker_id: input.workerId || process.env.AUTOMATION_WORKER_ID || "faust-worker",
        status: "healthy",
        concurrency: input.concurrency || 4,
        polling_interval_ms: input.pollingIntervalMs || 5000,
        lease_timeout_ms: input.leaseTimeoutMs || 30000,
        detail: "Worker tick processed through staging service route.",
      }).select("id,worker_id,last_beat_at").single();
      if (error) throw new Error(`Worker heartbeat failed: ${error.message}`);
      return Response.json({ ok: true, actionResult: { id: data.id, workerId: data.worker_id, lastBeatAt: data.last_beat_at, dueCount: 0, runs: [] } });
    }
    const result = await mutateAutomation(input.action, input as AutomationMutationInput);
    return Response.json({ ok: true, data: result.data, actionResult: result.actionResult, snapshot: snapshot(result.data) });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Automation action failed." }, { status: 400 });
  }
}
