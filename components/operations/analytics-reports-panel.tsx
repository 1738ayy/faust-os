"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyticsModel } from "@/lib/analytics";
import type { AnalyticsSavedReport } from "@/domain/business";

const button = "rounded-full border border-red-950/60 bg-zinc-950/50 px-3 py-1.5 text-xs font-medium transition hover:border-red-500/50 hover:text-white disabled:opacity-50";

export function AnalyticsReportsPanel({ analytics }: { analytics: AnalyticsModel }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [activeReport, setActiveReport] = useState<AnalyticsSavedReport | undefined>(analytics.reports[0]);

  async function run(action: string, payload: Record<string, unknown>) {
    setBusy(action); setMessage("");
    try {
      const response = await fetch("/api/analytics/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Analytics report action failed.");
      if (body.actionResult?.id && ["create-report", "update-report", "duplicate-report"].includes(action)) {
        setActiveReport({
          id: body.actionResult.id,
          name: body.actionResult.name,
          description: body.actionResult.description,
          sections: body.actionResult.sections || [],
          metrics: body.actionResult.metrics || [],
          filters: body.actionResult.filters || {},
          drilldowns: body.actionResult.drilldowns || [],
          schedule: body.actionResult.schedule,
          exportFormat: body.actionResult.exportFormat || body.actionResult.export_format || "csv",
          isDefault: body.actionResult.isDefault || body.actionResult.is_default,
          createdBy: body.actionResult.createdBy || body.actionResult.created_by,
          lastRunAt: body.actionResult.lastRunAt || body.actionResult.last_run_at,
          createdAt: body.actionResult.createdAt || body.actionResult.created_at || new Date().toISOString(),
          updatedAt: body.actionResult.updatedAt || body.actionResult.updated_at,
        });
      }
      setMessage(`Analytics ${action.replaceAll("-", " ")} saved.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analytics report action failed.");
    } finally {
      setBusy("");
    }
  }

  return <section aria-label="Analytics report builder" className="faust-surface overflow-hidden">
    <h2 className="border-b border-red-950/45 px-5 py-4 font-semibold">Custom Report Builder</h2>
    <div className="grid gap-4 p-5 lg:grid-cols-4">
      <div className="faust-card p-4"><h3 className="font-semibold">Saved reports</h3><p className="mt-2 text-xs text-muted-foreground">Create a reusable report with saved sections, filters, metrics, drilldowns, and CSV export settings.</p><button className={`${button} mt-4`} disabled={busy === "create-report"} onClick={() => run("create-report", { name: "SKU capital utilization review", description: "Inventory aging, lot profitability, and SKU cash risk.", sections: ["Product Analytics", "Inventory Analytics", "Finance Analytics"], metrics: ["capitalUtilization", "lotAging", "stockoutRisk"], filters: analytics.filters, scheduleFrequency: "weekly", recipients: ["ops@example.test"], idempotencyKey: crypto.randomUUID() })}>Create saved report</button></div>
      <div className="faust-card p-4"><h3 className="font-semibold">Saved filters</h3><p className="mt-2 text-xs text-muted-foreground">Keep active marketplace, SKU, supplier, and date filters ready for future runs.</p><button className={`${button} mt-4`} disabled={!activeReport || busy === "update-report"} onClick={() => activeReport && run("update-report", { reportId: activeReport.id, name: activeReport.name, sections: activeReport.sections, metrics: activeReport.metrics, filters: analytics.filters, drilldowns: activeReport.drilldowns, scheduleFrequency: activeReport.schedule?.frequency || "weekly", recipients: activeReport.schedule?.recipients || [] })}>Save active filters</button></div>
      <div className="faust-card p-4"><h3 className="font-semibold">Schedule</h3><p className="mt-2 text-xs text-muted-foreground">Store cadence and recipients now; delivery can connect to email or automations later.</p><button className={`${button} mt-4`} disabled={!activeReport || busy === "duplicate-report"} onClick={() => activeReport && run("duplicate-report", { reportId: activeReport.id })}>Duplicate report</button></div>
      <div className="faust-card p-4"><h3 className="font-semibold">Run history</h3><p className="mt-2 text-xs text-muted-foreground">Record report runs so forecast accuracy and scheduled exports have a clean history.</p><button className={`${button} mt-4`} disabled={!activeReport || busy === "record-run"} onClick={() => activeReport && run("record-run", { reportId: activeReport.id, filters: analytics.filters, rowCount: analytics.csvRows.length })}>Record export run</button></div>
    </div>
    {message && <p role="status" className="border-t border-red-950/45 px-5 py-3 text-sm text-red-200">{message}</p>}
  </section>;
}
