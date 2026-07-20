import Link from "next/link";
import { Search } from "lucide-react";
import { AppLayout } from "@/components/navigation/app-layout";
import { EmptyState, PageHeader } from "@/components/faust/design-system";
import { getOperatingData } from "@/services/operating-system/repository";
import { getOpportunities } from "@/services/opportunities/local-opportunity-store";
import { suppliersRepository } from "@/services/suppliers/repository";
import { ordersRepository } from "@/services/orders/repository";
import { parcelsRepository } from "@/services/parcels/repository";
import { activeVariants } from "@/lib/product-state";

type SearchResult = {
  label: string;
  href: string;
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim().toLowerCase();
  const [operatingData, opportunities, suppliers, orders, parcels] = await Promise.all([
    getOperatingData(),
    getOpportunities(),
    suppliersRepository.all(),
    ordersRepository.all(),
    parcelsRepository.all(),
  ]);

  const productMatches: SearchResult[] = activeVariants(operatingData)
    .filter((variant) => {
      const product = operatingData.products.find((item) => item.id === variant.productId);
      const supplier = product ? operatingData.suppliers.find((item) => item.id === product.supplierId) : undefined;
      return `${product?.title || ""} ${variant.title} ${variant.sku} ${supplier?.name || ""}`.toLowerCase().includes(term);
    })
    .map((variant) => {
      const product = operatingData.products.find((item) => item.id === variant.productId);
      return { label: `${product?.title || "Product"} — ${variant.sku}`, href: `/catalog/${variant.id}` };
    });

  const opportunityMatches: SearchResult[] = opportunities
    .filter((item) => `${item.product.name} ${item.product.supplier.name || ""}`.toLowerCase().includes(term))
    .map((item) => ({ label: item.product.name, href: "/opportunity" }));

  const groups = term
    ? [
        { label: "Products", values: [...productMatches, ...opportunityMatches] },
        {
          label: "Suppliers",
          values: suppliers
            .filter((item) => `${item.name} ${item.storeName || ""}`.toLowerCase().includes(term))
            .map((item) => ({ label: item.name, href: "/suppliers" })),
        },
        {
          label: "Orders",
          values: orders
            .filter((item) => `${item.customer} ${item.itemName}`.toLowerCase().includes(term))
            .map((item) => ({ label: `${item.itemName} — ${item.customer}`, href: "/logistics" })),
        },
        {
          label: "Parcels",
          values: parcels
            .filter((item) => `${item.trackingNumber} ${item.carrier || ""}`.toLowerCase().includes(term))
            .map((item) => ({ label: item.trackingNumber, href: "/logistics" })),
        },
      ].filter((group) => group.values.length)
    : [];

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader eyebrow="Search" title="Global Search" description="Find products, suppliers, orders, and parcels from one Faust surface." />
        <form className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Search Faust OS..." className="faust-field faust-focus h-14 w-full pl-12 pr-4 text-lg" autoFocus />
        </form>
        {term &&
          (groups.length ? (
            <div className="space-y-4">
              {groups.map((group) => (
                <section key={group.label} className="faust-surface overflow-hidden">
                  <div className="border-b border-slate-700/45 px-5 py-3 text-sm font-medium text-muted-foreground">{group.label}</div>
                  {group.values.map((value) => (
                    <Link key={`${value.href}-${value.label}`} href={value.href} className="block border-b border-slate-700/35 px-5 py-4 text-sm transition last:border-0 hover:bg-slate-800/15">
                      {value.label}
                    </Link>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <EmptyState title="No matching records" description={`No records match "${q}". Try a product, supplier, order, or tracking number.`} />
          ))}
      </div>
    </AppLayout>
  );
}
