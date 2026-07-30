import { Bug, ClipboardList, Gauge, HeartPulse, ServerCog, ShieldCheck } from "lucide-react";

import { AppLayout } from "@/components/navigation/app-layout";
import { DataCard, DataTable, EmptyState, MetricCard, PageHeader, StatusBadge, TableCell } from "@/components/faust/design-system";
import { OperationsFeedbackForm } from "@/components/settings/operations-feedback-form";
import { productionOperationsMetrics } from "@/lib/daily-operations";
import { productionHealth } from "@/lib/production-health";
import { getOperatingData } from "@/services/operating-system/repository";

export default async function SystemHealthPage() {
  const data = await getOperatingData();
  const operations = productionOperationsMetrics(data);
  const health = productionHealth(data);
  const rcTone = operations.releaseCandidate.ready ? "success" : operations.releaseCandidate.blockers ? "danger" : "warning";

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Internal operations"
          title="System Health & Daily Operations"
          description="Track dogfooding friction, production readiness, worker health, queues, failures, and release-candidate blockers without pushing implementation details into normal business workflows."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Release candidate" value={operations.releaseCandidate.ready ? "Ready" : "Blocked"} detail={operations.releaseCandidate.summary} />
          <MetricCard label="Queue depth" value={operations.counts.queueDepth} detail={`${operations.counts.failedJobs} failed task(s) · ${operations.counts.automationBacklog} automation waiting`} />
          <MetricCard label="Import success" value={`${operations.metrics.importSuccessRate}%`} detail={`${operations.dogfooding.totals.imported} product(s) dogfooded`} />
          <MetricCard label="Publish success" value={`${operations.metrics.publishSuccessRate}%`} detail={`${operations.counts.publishedProducts} product(s) published or confirmed`} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <DataCard title="Release candidate readiness" description="The compact operating gate before Faust is trusted with a larger inventory." icon={ShieldCheck}>
            <div className="mb-4 flex items-center justify-between rounded-3xl border border-slate-700/35 bg-black/30 p-4">
              <div>
                <p className="text-sm text-muted-foreground">Current RC status</p>
                <h2 className="mt-1 text-2xl font-semibold">{operations.releaseCandidate.ready ? "No release blockers detected." : `${operations.releaseCandidate.blockers} blocker(s) require attention.`}</h2>
              </div>
              <StatusBadge value={operations.releaseCandidate.ready ? "ready" : "needs attention"} tone={rcTone} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Check label="No critical workflow bugs" ok={!operations.feedback.some((entry) => entry.severity === "critical")} />
              <Check label="High-severity issues triaged" ok={!operations.feedback.some((entry) => entry.severity === "high")} />
              <Check label="Background failures clear" ok={!operations.failedJobs.length} />
              <Check label="Service health visible" ok={health.status !== "blocked"} />
              <Check label="Migrations ordered" ok={health.checks.migrations.ready} />
              <Check label="Worker observable" ok={health.checks.worker.ready} />
            </div>
          </DataCard>

          <DataCard title="Dogfooding feedback" description="Record real friction as it happens. High and critical issues automatically create tasks and notices." icon={Bug}>
            <OperationsFeedbackForm />
          </DataCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <DataCard title="Performance budgets" description="Targets for daily-use responsiveness." icon={Gauge}>
            <div className="space-y-3 text-sm">
              <Row label="Import → queue" value="< 2s" />
              <Row label="Review session render" value="< 500ms" />
              <Row label="Draft generation" value="< 1s" />
              <Row label="Queue refresh" value="< 250ms" />
              <Row label="Action Center render" value="< 500ms" />
            </div>
          </DataCard>
          <DataCard title="Worker health" description="Background work should be visible and recoverable." icon={HeartPulse}>
            <div className="space-y-3 text-sm">
              <Row label="Status" value={health.checks.worker.status} />
              <Row label="Queue depth" value={health.checks.worker.queueDepth} />
              <Row label="Dead letters" value={health.checks.worker.deadLetters} />
              <Row label="Last heartbeat" value={health.checks.worker.lastHeartbeatAt ? new Date(health.checks.worker.lastHeartbeatAt).toLocaleString() : "not seen"} />
            </div>
          </DataCard>
          <DataCard title="Environment health" description="Deployment essentials and provider boundaries." icon={ServerCog}>
            <div className="space-y-3 text-sm">
              <Row label="Environment" value={health.checks.environment.status} />
              <Row label="Database" value={health.checks.database.status} />
              <Row label="Storage" value={health.checks.storage.status} />
              <Row label="Providers" value={health.checks.providers.status} />
            </div>
          </DataCard>
        </section>

        <DataCard title="Open feedback and bug debt" description="Dogfooding issues ordered by severity, then recency." icon={ClipboardList}>
          {operations.feedback.length ? (
            <DataTable headers={["Issue", "Severity", "Workflow", "Frequency", "Impact"]}>
              {operations.feedback.map((entry) => (
                <tr key={entry.id}>
                  <TableCell primary={entry.title} secondary={entry.proposedImprovement || entry.actualAction || "Needs triage"} />
                  <TableCell primary={<StatusBadge value={entry.severity} tone={entry.severity === "critical" ? "danger" : entry.severity === "high" ? "warning" : "neutral"} />} />
                  <TableCell primary={entry.workflow} />
                  <TableCell primary={entry.frequency || 1} />
                  <TableCell primary={`${entry.timeLostMinutes || 0} min lost`} secondary={entry.status} />
                </tr>
              ))}
            </DataTable>
          ) : <EmptyState title="No open dogfooding feedback." description="Use Faust for a real sourcing session. Anything annoying, slow, confusing, or broken belongs here." />}
        </DataCard>

        <section className="grid gap-6 lg:grid-cols-2">
          <DataCard title="Failed tasks" description="Failures that require operational review before trusting larger workloads.">
            <div className="space-y-3">
              {operations.failedJobs.slice(0, 8).map((job) => <article className="faust-card p-3" key={job.id}><b>{job.label}</b><p className="mt-1 text-sm text-muted-foreground">{job.detail}</p></article>)}
              {!operations.failedJobs.length && <p className="text-sm text-muted-foreground">No failed task is currently blocking operations.</p>}
            </div>
          </DataCard>
          <DataCard title="Recent error signals" description="Correlation-friendly errors from automations and marketplace connectors.">
            <div className="space-y-3">
              {operations.recentErrors.map((error) => <article className="faust-card p-3" key={error.id}><b>{error.title}</b><p className="mt-1 text-sm text-muted-foreground">{error.detail || "No correlation ID recorded."}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(error.at).toLocaleString()}</p></article>)}
              {!operations.recentErrors.length && <p className="text-sm text-muted-foreground">No recent production error signals.</p>}
            </div>
          </DataCard>
        </section>
      </div>
    </AppLayout>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return <div className="flex items-center justify-between rounded-2xl border border-slate-700/35 bg-black/25 px-3 py-2 text-sm"><span>{label}</span><StatusBadge value={ok ? "ok" : "needs attention"} tone={ok ? "success" : "warning"} /></div>;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/30 bg-black/25 px-3 py-2"><span className="text-muted-foreground">{label}</span><b>{value}</b></div>;
}
