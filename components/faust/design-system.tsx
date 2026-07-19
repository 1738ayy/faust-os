import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ArrowRight, Loader2, PackageOpen, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export function formatStatus(value?: string) {
  if (!value) return "Not set";
  const labels: Record<string, string> = {
    not_requested: "Not requested",
    ready_to_ship: "Ready to ship",
    ready_to_pack: "Ready to pack",
    inventory_reserved: "Reserved",
    label_purchased: "Label ready",
    in_transit: "In transit",
    risk_locked: "Needs review",
    dead_letter: "Failed task",
    dead_lettered: "Failed task",
    local_mock: "Test service",
    manual_adapter: "Manual workflow",
    synced: "Synced",
    failed: "Needs attention",
    open: "Open",
    active: "Active",
    completed: "Complete",
    pending: "Pending",
    pending_approval: "Needs approval",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
    delivered: "Delivered",
    packed: "Packed",
    picking: "Picking",
    packing: "Packing",
    shipped: "Shipped",
  };
  return labels[value] || value.replaceAll("_", " ");
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: { label: string; href: string } }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.2em] text-red-300">{eyebrow}</p>}
        <h1 data-testid="page-title" className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action && <PrimaryButton href={action.href}>{action.label}<ArrowRight size={15} /></PrimaryButton>}
    </header>
  );
}

export function PrimaryButton({ href, children, className }: { href?: string; children: ReactNode; className?: string }) {
  const classes = cn("faust-action focus-visible:ring-3 focus-visible:ring-red-500/30", className);
  return href ? <Link href={href} className={classes}>{children}</Link> : <button className={classes}>{children}</button>;
}

export function SecondaryButton({ href, children, className }: { href?: string; children: ReactNode; className?: string }) {
  const classes = cn("faust-secondary-action focus-visible:ring-3 focus-visible:ring-red-500/25", className);
  return href ? <Link href={href} className={classes}>{children}</Link> : <button className={classes}>{children}</button>;
}

export function DangerButton({ children, className }: { children: ReactNode; className?: string }) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 focus-visible:ring-3 focus-visible:ring-red-500/25", className)}>{children}</button>;
}

export function DataCard({ title, description, children, className, icon: Icon }: { title?: string; description?: string; children: ReactNode; className?: string; icon?: ComponentType<{ className?: string }> }) {
  return (
    <section className={cn("faust-surface overflow-hidden p-5", className)}>
      {(title || description || Icon) && <div className="mb-4 flex items-start gap-3">
        {Icon && <Icon className="mt-1 h-5 w-5 text-red-300" />}
        <div>
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
      </div>}
      {children}
    </section>
  );
}

export function MetricCard({ label, value, detail, href }: { label: string; value: ReactNode; detail?: string; href?: string }) {
  const content = (
    <article className="faust-card p-4 hover:-translate-y-0.5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>}
    </article>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: { label: string; href: string } }) {
  return (
    <div className="mx-auto rounded-3xl border border-dashed border-red-500/35 bg-zinc-950/60 p-10 text-center shadow-2xl shadow-black/25 backdrop-blur">
      <PackageOpen className="mx-auto h-9 w-9 text-red-300" />
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-7"><PrimaryButton href={action.href}>{action.label}</PrimaryButton></div>}
    </div>
  );
}

export function LoadingState({ label = "Loading Faust workspace..." }: { label?: string }) {
  return <div className="faust-surface flex items-center gap-3 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-red-300" />{label}</div>;
}

export function ErrorState({ title = "Something needs attention", description }: { title?: string; description: string }) {
  return <div className="faust-surface flex gap-3 border-red-500/30 p-5 text-sm"><TriangleAlert className="mt-0.5 h-5 w-5 text-red-300" /><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-muted-foreground">{description}</p></div></div>;
}

export function StatusBadge({ value, tone = "neutral" }: { value?: string; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const toneClasses = {
    neutral: "border-red-950/45 bg-black/35 text-zinc-200",
    success: "border-red-500/25 bg-red-500/10 text-red-100",
    warning: "border-amber-500/25 bg-amber-500/10 text-amber-200",
    danger: "border-red-500/30 bg-red-500/10 text-red-200",
    info: "border-red-500/25 bg-red-500/10 text-red-100",
  }[tone];
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize", toneClasses)}>{formatStatus(value)}</span>;
}

export function MarketplaceBadge({ marketplace }: { marketplace: string }) {
  return <span className="inline-flex rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-100">{marketplace}</span>;
}

export function ConfidenceBadge({ value }: { value: number }) {
  const tone = value >= 0.75 ? "success" : value >= 0.45 ? "warning" : "danger";
  return <StatusBadge tone={tone} value={`${Math.round(value * 100)}% confidence`} />;
}

export function DataTable({ headers, children, minWidth = 720 }: { headers: string[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="faust-surface overflow-x-auto p-0">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="border-b border-red-950/45 bg-black/20 text-xs text-muted-foreground">
          <tr>{headers.map((header) => <th className="px-5 py-3 font-medium" key={header}>{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-red-950/30">{children}</tbody>
      </table>
    </div>
  );
}

export function TableCell({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return <td className="px-5 py-3"><b className="block font-medium">{primary}</b>{secondary && <span className="mt-1 block text-xs text-muted-foreground">{secondary}</span>}</td>;
}

export function ActivityTimeline({ items }: { items: { id: string; title: string; detail?: string; at?: string }[] }) {
  return <div className="space-y-3">{items.map((item) => <div className="relative pl-5" key={item.id}><span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-red-400 shadow-[0_0_16px_rgba(248,113,113,.55)]" /><p className="text-sm font-medium">{item.title}</p>{item.detail && <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>}{item.at && <p className="mt-1 text-xs text-muted-foreground">{item.at}</p>}</div>)}</div>;
}
