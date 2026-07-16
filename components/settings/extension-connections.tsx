import type { OperatingData } from "@/domain/business";
import { extensionConnectionSummary } from "@/lib/browser-extension";

export function ExtensionConnections({ data }: { data: OperatingData }) {
  const summary = extensionConnectionSummary(data);
  return <section className="rounded-xl border border-border bg-card p-6" aria-label="Connected extension devices">
    <div>
      <h2 className="text-lg font-semibold">Connected extension devices</h2>
      <p className="mt-1 text-sm text-muted-foreground">Device registration, health, artifacts, and failed extension actions before live-site testing.</p>
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Devices</p><p className="mt-2 text-2xl font-bold">{summary.devices?.length || 0}</p></div>
      <div className="rounded-lg border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Artifacts</p><p className="mt-2 text-2xl font-bold">{summary.artifacts?.length || 0}</p></div>
      <div className="rounded-lg border border-border p-4"><p className="text-xs uppercase text-muted-foreground">Adapter health</p><p className="mt-2 text-2xl font-bold">{summary.adapters.filter((adapter) => adapter.status === "healthy").length}/5</p></div>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="font-semibold">Devices</h3>
        <div className="mt-3 divide-y divide-border rounded-lg border border-border">
          {summary.devices?.map((device) => <div className="p-4 text-sm" key={device.id}><div className="flex items-center justify-between gap-4"><span className="font-medium">{device.name}</span><span className={device.status === "active" ? "text-emerald-300" : "text-red-300"}>{device.status}</span></div><p className="mt-1 text-muted-foreground">{device.browser} · {device.environment} · v{device.version}</p><p className="mt-1 text-xs text-muted-foreground">Last seen {new Date(device.lastSeenAt).toLocaleString()} · revoke through /api/extension/revoke</p></div>)}
          {!summary.devices?.length && <p className="p-4 text-sm text-muted-foreground">No extension devices registered yet.</p>}
        </div>
      </div>
      <div>
        <h3 className="font-semibold">Marketplace adapter health</h3>
        <div className="mt-3 divide-y divide-border rounded-lg border border-border">
          {summary.adapters.map((adapter) => <div className="p-4 text-sm" key={adapter.marketplace}><div className="flex items-center justify-between gap-4"><span className="font-medium">{adapter.marketplace}</span><span className="text-emerald-300">{adapter.status}</span></div><p className="mt-1 text-muted-foreground">v{adapter.version} · {adapter.fallbackCoverage}/{adapter.requiredFields} required fields have fallback coverage</p></div>)}
        </div>
      </div>
      <div>
        <h3 className="font-semibold">Recent extension actions</h3>
        <div className="mt-3 divide-y divide-border rounded-lg border border-border">
          {summary.actions?.slice(0, 6).map((action) => <div className="p-4 text-sm" key={action.id}><div className="flex items-center justify-between gap-4"><span className="font-medium">{action.action}</span><span>{action.status}</span></div><p className="mt-1 text-muted-foreground">{action.detail}</p><p className="mt-1 text-xs text-muted-foreground">Correlation {action.correlationId.slice(0, 8)}</p></div>)}
          {!summary.actions?.length && <p className="p-4 text-sm text-muted-foreground">Extension actions will appear here after registration, scans, syncs, failures, and confirmations.</p>}
        </div>
      </div>
      <div>
        <h3 className="font-semibold">Failed-action artifacts</h3>
        <div className="mt-3 divide-y divide-border rounded-lg border border-border">
          {summary.artifacts?.slice(0, 6).map((artifact) => <div className="p-4 text-sm" key={artifact.id}><div className="flex items-center justify-between gap-4"><span className="font-medium">{artifact.type}</span><span>{artifact.marketplace || "source"}</span></div><p className="mt-1 text-muted-foreground">{artifact.url || "Metadata stored; provider boundary ready."}</p></div>)}
          {!summary.artifacts?.length && <p className="p-4 text-sm text-muted-foreground">Screenshots, DOM snapshots, logs, failed fields, and publish evidence metadata will appear here.</p>}
        </div>
      </div>
    </div>
  </section>;
}
