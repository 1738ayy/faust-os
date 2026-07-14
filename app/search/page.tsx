import Link from "next/link";
import { Search } from "lucide-react";
import { AppLayout } from "@/components/navigation/app-layout";
import { getOpportunities } from "@/services/opportunities/local-opportunity-store";
import { suppliersRepository } from "@/services/suppliers/repository";
import { ordersRepository } from "@/services/orders/repository";
import { parcelsRepository } from "@/services/parcels/repository";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams; const term = q.trim().toLowerCase();
  const [opportunities, suppliers, orders, parcels] = await Promise.all([getOpportunities(), suppliersRepository.all(), ordersRepository.all(), parcelsRepository.all()]);
  const groups = term ? [{ label: "Products", href: "/catalog", values: opportunities.filter((item) => `${item.product.name} ${item.product.supplier.name || ""}`.toLowerCase().includes(term)).map((item) => item.product.name) }, { label: "Suppliers", href: "/suppliers", values: suppliers.filter((item) => `${item.name} ${item.storeName || ""}`.toLowerCase().includes(term)).map((item) => item.name) }, { label: "Orders", href: "/logistics", values: orders.filter((item) => `${item.customer} ${item.itemName}`.toLowerCase().includes(term)).map((item) => `${item.itemName} — ${item.customer}`) }, { label: "Parcels", href: "/logistics", values: parcels.filter((item) => `${item.trackingNumber} ${item.carrier || ""}`.toLowerCase().includes(term)).map((item) => item.trackingNumber) }].filter((group) => group.values.length) : [];
  return <AppLayout><div className="mx-auto max-w-3xl space-y-6"><div><h1 className="text-3xl font-bold">Global Search</h1><p className="mt-2 text-muted-foreground">Find products, suppliers, orders, and parcels.</p></div><form className="relative"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input name="q" defaultValue={q} placeholder="Search Faust OS…" className="h-14 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-lg outline-none focus:border-violet-500" autoFocus /></form>{term && (groups.length ? <div className="space-y-4">{groups.map((group) => <section key={group.label} className="rounded-xl border border-border bg-card"><div className="border-b border-border px-5 py-3 text-sm font-medium text-muted-foreground">{group.label}</div>{group.values.map((value) => <Link key={value} href={group.href} className="block border-b border-border px-5 py-4 last:border-0 hover:bg-muted/40">{value}</Link>)}</section>)}</div> : <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">No records match “{q}”.</div>)}</div></AppLayout>;
}
