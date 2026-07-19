"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OperatingData } from "@/domain/business";

const button = "rounded-full border border-red-950/60 bg-zinc-950/50 px-3 py-1.5 text-xs font-medium transition hover:border-red-500/50 hover:text-white disabled:opacity-50";

export function AutomationsEnginePanel({ data }: { data: OperatingData }) {
  const router = useRouter();
  const [activeRuleId, setActiveRuleId] = useState(data.automationRules?.[0]?.id);
  const [activeRunId, setActiveRunId] = useState(data.automationRuns?.[0]?.id);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const approval = data.automationApprovals?.find((item) => item.status === "pending");
  const failedRun = data.automationRuns?.find((item) => ["failed", "dead_lettered"].includes(item.status));
  const deadLetter = data.automationDeadLetters?.find((item) => item.status === "open" || item.status === "retried");

  async function run(action: string, payload: Record<string, unknown>) {
    setBusy(action); setMessage("");
    try {
      const response = await fetch("/api/automations/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Automation action failed.");
      if (body.actionResult?.id && ["create-rule", "duplicate-rule", "enable-rule", "disable-rule", "archive-rule"].includes(action)) setActiveRuleId(body.actionResult.id);
      if (body.actionResult?.id && ["test-rule", "trigger-run", "retry-run"].includes(action)) setActiveRunId(body.actionResult.id);
      setMessage(`Automation ${action.replaceAll("-", " ")} saved.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Automation action failed.");
    } finally {
      setBusy("");
    }
  }

  return <section aria-label="Automation builder" className="faust-surface overflow-hidden">
    <h2 className="border-b border-red-950/45 px-5 py-4 font-semibold">Rule Builder & Operations Console</h2>
    <div className="grid gap-4 p-5 lg:grid-cols-4">
      <div className="faust-card p-4"><h3 className="font-semibold">Builder</h3><p className="mt-2 text-xs text-muted-foreground">Create or install editable production templates with approval rules.</p><div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={busy === "create-rule"} onClick={() => run("create-rule", { name: "Low stock reorder automation", templateId: "auto-template-low-stock", enabled: false, dryRun: true, idempotencyKey: crypto.randomUUID() })}>Create rule</button><button className={button} disabled={busy === "install-template"} onClick={() => run("install-template", { name: "Cash threshold approval", templateId: "auto-template-cash-threshold", threshold: 750, enabled: false, dryRun: false, idempotencyKey: crypto.randomUUID() })}>Install template</button></div></div>
      <div className="faust-card p-4"><h3 className="font-semibold">Test & enable</h3><p className="mt-2 text-xs text-muted-foreground">Try the rule safely, then turn it on when the result looks right.</p><div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={!activeRuleId || busy === "test-rule"} onClick={() => activeRuleId && run("test-rule", { ruleId: activeRuleId })}>Test rule</button><button className={button} disabled={!activeRuleId || busy === "enable-rule"} onClick={() => activeRuleId && run("enable-rule", { ruleId: activeRuleId })}>Enable rule</button></div></div>
      <div className="faust-card p-4"><h3 className="font-semibold">Run</h3><p className="mt-2 text-xs text-muted-foreground">Start a rule, send a Faust event, or process the next background task.</p><div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={!activeRuleId || busy === "trigger-run"} onClick={() => activeRuleId && run("trigger-run", { ruleId: activeRuleId, samplePayload: { available: 1, reorderPoint: 2, sku: "FST-HOOD-001" }, idempotencyKey: crypto.randomUUID() })}>Run now</button><button className={button} disabled={busy === "trigger-event"} onClick={() => run("trigger-event", { triggerType: "inventory.below_reorder_point", samplePayload: { id: crypto.randomUUID(), available: 1, reorderPoint: 2, sku: "FST-HOOD-001", aggregateType: "variant", aggregateId: data.variants[0]?.id }, idempotencyKey: crypto.randomUUID() })}>Send event</button><button className={button} disabled={busy === "worker-tick"} onClick={() => run("worker-tick", { workerId: "browser-worker", concurrency: 4 })}>Process tasks</button></div></div>
      <div className="faust-card p-4"><h3 className="font-semibold">Review</h3><p className="mt-2 text-xs text-muted-foreground">Pause schedules, approve actions, recover failed tasks, and keep the audit trail intact.</p><div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={!activeRuleId || busy === "pause-schedule"} onClick={() => activeRuleId && run("pause-schedule", { ruleId: activeRuleId })}>Pause schedule</button><button className={button} disabled={!activeRuleId || busy === "resume-schedule"} onClick={() => activeRuleId && run("resume-schedule", { ruleId: activeRuleId })}>Resume schedule</button><button className={button} disabled={!activeRuleId || busy === "duplicate-rule"} onClick={() => activeRuleId && run("duplicate-rule", { ruleId: activeRuleId })}>Duplicate rule</button><button className={button} disabled={!activeRuleId || busy === "archive-rule"} onClick={() => activeRuleId && run("archive-rule", { ruleId: activeRuleId })}>Archive rule</button><button className={button} disabled={!approval || busy === "approve-action"} onClick={() => approval && run("approve-action", { runId: approval.id })}>Approve action</button><button className={button} disabled={!failedRun || busy === "retry-run"} onClick={() => failedRun && run("retry-run", { runId: failedRun.id })}>Retry failure</button><button className={button} disabled={!deadLetter || busy === "replay-dead-letter"} onClick={() => deadLetter && run("replay-dead-letter", { deadLetterId: deadLetter.id })}>Replay failed task</button></div></div>
    </div>
    {message && <p role="status" className="border-t border-red-950/45 px-5 py-3 text-sm text-red-200">{message}</p>}
    <input type="hidden" aria-label="active automation run" value={activeRunId || ""} readOnly />
  </section>;
}
