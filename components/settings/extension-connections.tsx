import type { OperatingData } from "@/domain/business";
import { DataCard, StatusBadge } from "@/components/faust/design-system";
import { extensionConnectionSummary } from "@/lib/browser-extension";

export function ExtensionConnections({ data }: { data: OperatingData }) {
  const summary = extensionConnectionSummary(data);
  return (
    <section aria-label="Connected extension devices">
      <div>
        <h2 className="text-lg font-semibold">Connected extension devices</h2>
        <p className="mt-1 text-sm text-muted-foreground">Registered browsers, recent activity, saved evidence, and marketplace connection health.</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <DataCard><p className="text-sm text-muted-foreground">Browsers</p><p className="mt-2 text-2xl font-bold">{summary.devices?.length || 0}</p></DataCard>
        <DataCard><p className="text-sm text-muted-foreground">Saved evidence</p><p className="mt-2 text-2xl font-bold">{summary.artifacts?.length || 0}</p></DataCard>
        <DataCard><p className="text-sm text-muted-foreground">Marketplace connections</p><p className="mt-2 text-2xl font-bold">{summary.adapters.filter((adapter) => adapter.status === "healthy").length}/5</p></DataCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold">Browsers</h3>
          <div className="mt-3 divide-y divide-slate-700/35 rounded-2xl border border-slate-700/45 bg-black/20">
            {summary.devices?.map((device) => (
              <div className="p-4 text-sm" key={device.id}>
                <div className="flex items-center justify-between gap-4"><span className="font-medium">{device.name}</span><StatusBadge value={device.status} tone={device.status === "active" ? "success" : "danger"} /></div>
                <p className="mt-1 text-muted-foreground">{device.browser} · {device.environment} · v{device.version}</p>
                <p className="mt-1 text-xs text-muted-foreground">Last seen {new Date(device.lastSeenAt).toLocaleString()}. Revoke access from Developer Tools.</p>
              </div>
            ))}
            {!summary.devices?.length && <p className="p-4 text-sm text-muted-foreground">No extension devices registered yet.</p>}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Marketplace connection health</h3>
          <div className="mt-3 divide-y divide-slate-700/35 rounded-2xl border border-slate-700/45 bg-black/20">
            {summary.adapters.map((adapter) => (
              <div className="p-4 text-sm" key={adapter.marketplace}>
                <div className="flex items-center justify-between gap-4"><span className="font-medium">{adapter.marketplace}</span><StatusBadge value={adapter.status} tone={adapter.status === "healthy" ? "success" : "warning"} /></div>
                <p className="mt-1 text-muted-foreground">Ready fields: {adapter.fallbackCoverage}/{adapter.requiredFields}. Technical version: {adapter.version}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Recent extension actions</h3>
          <div className="mt-3 divide-y divide-slate-700/35 rounded-2xl border border-slate-700/45 bg-black/20">
            {summary.actions?.slice(0, 6).map((action) => (
              <div className="p-4 text-sm" key={action.id}>
                <div className="flex items-center justify-between gap-4"><span className="font-medium">{action.action}</span><StatusBadge value={action.status} /></div>
                <p className="mt-1 text-muted-foreground">{action.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">Diagnostic reference {action.correlationId.slice(0, 8)}</p>
              </div>
            ))}
            {!summary.actions?.length && <p className="p-4 text-sm text-muted-foreground">Extension actions will appear here after registration, scans, syncs, failures, and confirmations.</p>}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Saved error evidence</h3>
          <div className="mt-3 divide-y divide-slate-700/35 rounded-2xl border border-slate-700/45 bg-black/20">
            {summary.artifacts?.slice(0, 6).map((artifact) => (
              <div className="p-4 text-sm" key={artifact.id}>
                <div className="flex items-center justify-between gap-4"><span className="font-medium">{artifact.type}</span><span>{artifact.marketplace || "source"}</span></div>
                <p className="mt-1 text-muted-foreground">{artifact.url || "Metadata stored; storage boundary ready."}</p>
              </div>
            ))}
            {!summary.artifacts?.length && <p className="p-4 text-sm text-muted-foreground">Screenshots, page snapshots, logs, failed fields, and publish evidence will appear here.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
