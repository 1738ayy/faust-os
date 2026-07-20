import type { ReactNode } from "react";

export function StatCard({ title, value, subtitle, icon }: { title: string; value: string; subtitle?: string; icon?: ReactNode }) {
  return <div className="faust-card p-6 hover:-translate-y-0.5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">{title}</p><h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{value}</h2>{subtitle && <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>}</div>{icon && <div className="rounded-2xl border border-sky-950/35 bg-sky-950/15 p-3 text-sky-100">{icon}</div>}</div></div>;
}
