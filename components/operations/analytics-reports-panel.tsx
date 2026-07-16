"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyticsModel } from "@/lib/analytics";

const button = "rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50";

export function AnalyticsReportsPanel({ analytics }: { analytics: AnalyticsModel }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const firstReport = analytics.reports[0];

  async function run(action: string, payload: Record<string, unknown>) {
    setBusy(action); setMessage("");
    try {
      const response = await fetch("/api/analytics/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Analytics report action failed.");
      setMessage(`Analytics ${action.replaceAll("-", " ")} saved.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analytics report action failed.");
    } finally {
      setBusy("");
    }
  }

  return <section aria-label="Analytics report builder" className="border border-border bg-card">
    <h2 className="border-b border-border px-5 py-4 font-semibold">Custom Report Builder</h2>
    <div className="grid gap-4 p-5 lg:grid-cols-4">
      <div className="border border-border p-4"><h3 className="font-semibold">Saved reports</h3><p className="mt-2 text-xs text-muted-foreground">Create a reusable report with persisted sections, filters, metrics, drilldowns, and CSV export settings.</p><button className={`${button} mt-4`} disabled={busy === "create-report"} onClick={() => run("create-report", { name: "SKU capital utilization review", description: "Inventory aging, lot profitability, and SKU cash risk.", sections: ["Product Analytics", "Inventory Analytics", "Finance Analytics"], metrics: ["capitalUtilization", "lotAging", "stockoutRisk"], filters: analytics.filters, scheduleFrequency: "weekly", recipients: ["ops@example.test"], idempotencyKey: crypto.randomUUID() })}>Create saved report</button></div>
      <div className="border border-border p-4"><h3 className="font-semibold">Filter persistence</h3><p className="mt-2 text-xs text-muted-foreground">Update a report so active marketplace, SKU, supplier, and date filters are retained for future runs.</p><button className={`${button} mt-4`} disabled={!firstReport || busy === "update-report"} onClick={() => firstReport && run("update-report", { reportId: firstReport.id, name: firstReport.name, sections: firstReport.sections, metrics: firstReport.metrics, filters: analytics.filters, scheduleFrequency: firstReport.schedule?.frequency || "weekly", recipients: firstReport.schedule?.recipients || [] })}>Save active filters</button></div>
      <div className="border border-border p-4"><h3 className="font-semibold">Scheduling metadata</h3><p className="mt-2 text-xs text-muted-foreground">Store cadence and recipients now; delivery can connect to email or automations later.</p><button className={`${button} mt-4`} disabled={!firstReport || busy === "duplicate-report"} onClick={() => firstReport && run("duplicate-report", { reportId: firstReport.id })}>Duplicate report</button></div>
      <div className="border border-border p-4"><h3 className="font-semibold">Export run history</h3><p className="mt-2 text-xs text-muted-foreground">Record report execution metadata so future forecast accuracy and scheduled exports have an audit trail.</p><button className={`${button} mt-4`} disabled={!firstReport || busy === "record-run"} onClick={() => firstReport && run("record-run", { reportId: firstReport.id, filters: analytics.filters, rowCount: analytics.csvRows.length })}>Record export run</button></div>
    </div>
    {message && <p role="status" className="border-t border-border px-5 py-3 text-sm text-emerald-300">{message}</p>}
  </section>;
}
