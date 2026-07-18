import type { ReactNode } from "react";

export function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon?: ReactNode }) {
  return (
    <article className="rounded-3xl border border-red-950/45 bg-zinc-950/55 p-4 shadow-lg shadow-black/20 backdrop-blur">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span>{label}</span>
        <span className="text-red-300">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  );
}
