"use client";

import { ArrowDownAZ, Copy, Filter, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProductCard } from "@/components/products/product-card";
import type { ProductExperience } from "@/lib/product-experience";

type SortKey = "newest" | "oldest" | "alphabetical" | "highest_profit" | "highest_revenue" | "highest_score" | "lowest_stock";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "alphabetical", label: "A to Z" },
  { value: "highest_profit", label: "Highest earning" },
  { value: "highest_revenue", label: "Highest revenue" },
  { value: "highest_score", label: "Best Faust score" },
  { value: "lowest_stock", label: "Lowest stock" },
];

export function CatalogWorkspace({ products, mode }: { products: ProductExperience[]; mode: string }) {
  const [sort, setSort] = useState<SortKey>("newest");
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const sortedProducts = useMemo(() => [...products].sort((a, b) => {
    if (sort === "oldest") return new Date(a.product.createdAt).getTime() - new Date(b.product.createdAt).getTime();
    if (sort === "alphabetical") return a.product.title.localeCompare(b.product.title);
    if (sort === "highest_profit") return b.finance.profit - a.finance.profit;
    if (sort === "highest_revenue") return b.finance.revenue - a.finance.revenue;
    if (sort === "highest_score") return b.intelligence.faustScore.score - a.intelligence.faustScore.score;
    if (sort === "lowest_stock") return a.inventory.available - b.inventory.available;
    return new Date(b.product.createdAt).getTime() - new Date(a.product.createdAt).getTime();
  }), [products, sort]);

  async function productAction(action: "duplicate" | "delete", variantId: string) {
    const response = await fetch("/api/products/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, variantId }) });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.message || "Product action failed.");
  }

  function run(label: string, callback: () => Promise<void>) {
    startTransition(async () => {
      try {
        await callback();
        toast.success(label);
        router.refresh();
      } catch (error) {
        toast.error("Could not finish that action", { description: error instanceof Error ? error.message : "Try again." });
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-sky-950/45 bg-zinc-950/55 p-4 shadow-lg shadow-black/20 backdrop-blur">
        <div className="mr-auto">
          <p className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4 text-sky-200" />Catalog controls</p>
          <p className="mt-1 text-xs text-muted-foreground">{mode === "empty" ? "No product records yet. Import your first item from the extension or sourcing workspace." : "Showing your saved product data."}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowDownAZ className="h-4 w-4 text-sky-200" />
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="faust-field faust-focus px-3 py-2 text-sm text-foreground">
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </section>

      <section className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3" aria-label="Product cards">
        {sortedProducts.map((item) => (
          <div key={item.variant.id} className="space-y-3">
            <ProductCard item={item} />
            <div className="flex flex-wrap justify-end gap-2 rounded-3xl border border-sky-950/35 bg-zinc-950/55 p-3">
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-sky-950/60 px-3 py-1.5 text-xs font-semibold text-sky-50 transition hover:border-sky-400/60 disabled:opacity-50" onClick={() => run("Product duplicated", () => productAction("duplicate", item.variant.id))}><Copy className="h-3.5 w-3.5" />Duplicate</button>
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-sky-950/60 px-3 py-1.5 text-xs font-semibold text-sky-50 transition hover:border-sky-400/60 disabled:opacity-50" onClick={() => run("Product removed from catalog", () => productAction("delete", item.variant.id))}><Trash2 className="h-3.5 w-3.5" />Delete</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
