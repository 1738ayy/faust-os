import { Activity, BarChart3, BrainCircuit, GitCompareArrows, LineChart, Microscope, PackageSearch, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/navigation/app-layout";
import { ActivityTimeline, DataCard, DataTable, MetricCard, PageHeader, StatusBadge, TableCell } from "@/components/faust/design-system";
import { getOperatingData } from "@/services/operating-system/repository";
import { adapterHealthDashboard, automationRuleEffectiveness, evidenceExplorer, intelligenceStudioSummary, learningExplorer, pipelineAnalytics, productDecisionTimeline } from "@/lib/intelligence-observability";
import { IntelligenceStudioControls } from "@/components/settings/intelligence-studio-controls";

export default async function IntelligenceStudioPage() {
  const data = await getOperatingData();
  const product = data.products[0];
  const timeline = product ? productDecisionTimeline(data, product.id) : [];
  const evidence = product ? evidenceExplorer(data, product.id) : [];
  const learning = learningExplorer(data);
  const ruleHealth = automationRuleEffectiveness(data);
  const adapterHealth = adapterHealthDashboard(data);
  const pipeline = pipelineAnalytics(data);
  const summary = intelligenceStudioSummary(data);
  const latestBenchmark = data.intelligenceBenchmarkRuns?.[0];
  const latestReplay = data.intelligenceReplayRuns?.[0];
  const latestParity = data.intelligenceRepositoryParityChecks?.[0];

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Developer tools"
          title="Intelligence Observability & Learning Studio"
          description="Trace, replay, benchmark, and export the decisions Faust makes across Product Knowledge, marketplace adapters, automations, and the Product Pipeline."
        />

        <IntelligenceStudioControls productId={product?.id} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Traceable decisions" value={timeline.length} detail={product ? product.title : "No Product selected"} />
          <MetricCard label="Benchmark accuracy" value={latestBenchmark ? `${latestBenchmark.accuracy}%` : "Not run"} detail={latestBenchmark?.versionLabel || "Run benchmark to persist history"} />
          <MetricCard label="Memory rules" value={learning.total} detail={`${learning.suspended} suspended · ${learning.unused} unused`} />
          <MetricCard label="Repository parity" value={latestParity?.ready ? "Ready" : "Not checked"} detail={latestParity ? `${latestParity.mismatches.length} mismatch(es)` : "Run parity check"} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <DataCard title="Decision Timeline" description="Every important Product decision in chronological order." icon={Activity}>
            {timeline.length ? <ActivityTimeline items={timeline.slice(0, 12).map((event) => ({ id: event.id, title: event.title, detail: `${event.detail} · ${event.confidence !== undefined ? `${Math.round(event.confidence * 100)}% confidence` : "recorded"}`, at: new Date(event.createdAt).toLocaleString() }))} /> : <p className="text-sm text-muted-foreground">Import or create a Product to build a decision timeline.</p>}
          </DataCard>

          <DataCard title="Evidence Explorer" description="Trace Product fields from raw supplier evidence to canonical values." icon={PackageSearch}>
            <div className="space-y-3">
              {evidence.slice(0, 8).map((field) => <article className="faust-card p-3" key={field.fieldKey}>
                <div className="flex items-center justify-between gap-3"><b>{field.fieldKey.replaceAll("_", " ")}</b><StatusBadge value={`${Math.round(field.confidence * 100)}% confidence`} /></div>
                <p className="mt-2 text-sm text-muted-foreground">Canonical: {String(field.finalCanonicalValue ?? "missing")}</p>
                <p className="mt-1 text-xs text-muted-foreground">Evidence {field.rawSupplierValues.length} · user decisions {field.userDecisions.length} · visual observations {field.visualObservations.length}</p>
              </article>)}
              {!evidence.length && <p className="text-sm text-muted-foreground">No Product Knowledge evidence is available yet.</p>}
            </div>
          </DataCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <DataCard title="Learning Explorer" description="Memory usage, conflicts, and suspended rules." icon={BrainCircuit}>
            <div className="grid gap-3 text-sm">
              <Row label="Strengthened" value={learning.strengthened} />
              <Row label="Weakened" value={learning.weakened} />
              <Row label="Suspended" value={learning.suspended} />
              <Row label="Conflicting" value={learning.conflicting.length} />
            </div>
          </DataCard>
          <DataCard title="Benchmark Studio" description="Versioned benchmark history and regressions." icon={Microscope}>
            {latestBenchmark ? <div className="space-y-3 text-sm"><Row label="Suite" value={latestBenchmark.suite} /><Row label="Accuracy" value={`${latestBenchmark.accuracy}%`} /><Row label="Previous" value={latestBenchmark.previousAccuracy === undefined ? "none" : `${latestBenchmark.previousAccuracy}%`} /><Row label="Regressions" value={latestBenchmark.regressionCount} /></div> : <p className="text-sm text-muted-foreground">Run a benchmark to create a persisted comparison point.</p>}
          </DataCard>
          <DataCard title="Confidence Calibration" description="Compare confidence against correctness and user corrections." icon={LineChart}>
            <div className="space-y-3 text-sm">
              <Row label="Average confidence" value={`${Math.round(summary.confidenceCalibration.averageConfidence * 100)}%`} />
              <Row label="Overconfidence bands" value={summary.confidenceCalibration.overconfidence} />
              <Row label="Underconfidence bands" value={summary.confidenceCalibration.underconfidence} />
              <Row label="Correction rate" value={`${summary.confidenceCalibration.userCorrectionRate}%`} />
            </div>
          </DataCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <DataCard title="Replay Mode" description="Compare historical Product output to current logic." icon={GitCompareArrows}>
            {latestReplay ? <div className="space-y-3 text-sm"><Row label="Product" value={data.products.find((entry) => entry.id === latestReplay.productId)?.title || latestReplay.productId} /><Row label="Historical fields" value={latestReplay.historicalFieldCount} /><Row label="Current fields" value={latestReplay.currentFieldCount} /><Row label="Changed fields" value={latestReplay.changedFields.filter((entry) => entry.changed).length} /></div> : <p className="text-sm text-muted-foreground">Replay a Product to compare past decisions with current logic.</p>}
          </DataCard>
          <DataCard title="Pipeline Analytics" description="Workflow optimization metrics across review and publishing." icon={BarChart3}>
            <div className="space-y-3 text-sm"><Row label="Import → ready" value={`${pipeline.averageImportToReadyMinutes} min`} /><Row label="Ready → publish" value={`${pipeline.averageReadyToPublishMinutes} min`} /><Row label="Products/session" value={pipeline.productsPerSession} /><Row label="Automation savings" value={`${pipeline.automationSavings} min`} /></div>
          </DataCard>
        </section>

        <DataCard title="Rule Effectiveness" description="Automation rules with executions, success, skips, blocks, retries, and overrides." icon={ShieldCheck}>
          <DataTable headers={["Rule", "Executions", "Success", "Skipped", "Blocked", "Retries"]}>
            {ruleHealth.map((rule) => <tr key={rule.ruleId}><TableCell primary={rule.name} secondary={`${rule.userOverrides} override(s)`} /><TableCell primary={rule.executions} /><TableCell primary={`${rule.successRate}%`} /><TableCell primary={rule.skipped} /><TableCell primary={rule.blocked} /><TableCell primary={rule.retries} /></tr>)}
          </DataTable>
        </DataCard>

        <DataCard title="Adapter Health Dashboard" description="Marketplace-independent connector health and diagnostics.">
          <DataTable headers={["Marketplace", "Publish success", "Sync latency", "Auth failures", "Retries", "Diagnostics"]}>
            {adapterHealth.map((adapter) => <tr key={adapter.marketplace}><TableCell primary={adapter.marketplace} /><TableCell primary={`${adapter.publishSuccessRate}%`} /><TableCell primary={`${adapter.syncLatency}ms`} /><TableCell primary={adapter.authenticationFailures} /><TableCell primary={adapter.retryCount} /><TableCell primary={adapter.diagnostics} /></tr>)}
          </DataTable>
          {!adapterHealth.length && <p className="mt-4 text-sm text-muted-foreground">Connector diagnostics appear after marketplace dry-runs, syncs, or publish attempts.</p>}
        </DataCard>

        <DataCard title="Diagnostics Bundles" description="Exportable issue-report bundles with Product state, evidence, benchmark, automation history, and connector diagnostics.">
          <div className="grid gap-3 md:grid-cols-2">
            {(data.intelligenceDiagnosticsBundles || []).slice(0, 6).map((bundle) => <article className="faust-card p-3" key={bundle.id}><b>{bundle.label}</b><p className="mt-1 text-sm text-muted-foreground">{bundle.summary}</p><p className="mt-2 text-xs text-muted-foreground">{bundle.sections.length} section(s) · {new Date(bundle.createdAt).toLocaleString()}</p></article>)}
          </div>
          {!(data.intelligenceDiagnosticsBundles || []).length && <p className="text-sm text-muted-foreground">No diagnostic bundle has been exported yet.</p>}
        </DataCard>
      </div>
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/30 bg-black/25 px-3 py-2"><span className="text-muted-foreground">{label}</span><b>{value}</b></div>;
}
