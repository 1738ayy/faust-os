"use client";

import { ArrowDownAZ, CheckSquare, Copy, Filter, Square, Trash2, X } from "lucide-react";
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
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const visibleProducts = useMemo(() => products.filter((item) => !locallyDeletedIds.includes(item.variant.id)), [locallyDeletedIds, products]);

  const sortedProducts = useMemo(() => [...visibleProducts].sort((a, b) => {
    if (sort === "oldest") return new Date(a.product.createdAt).getTime() - new Date(b.product.createdAt).getTime();
    if (sort === "alphabetical") return a.product.title.localeCompare(b.product.title);
    if (sort === "highest_profit") return b.finance.profit - a.finance.profit;
    if (sort === "highest_revenue") return b.finance.revenue - a.finance.revenue;
    if (sort === "highest_score") return b.intelligence.faustScore.score - a.intelligence.faustScore.score;
    if (sort === "lowest_stock") return a.inventory.available - b.inventory.available;
    return new Date(b.product.createdAt).getTime() - new Date(a.product.createdAt).getTime();
  }), [visibleProducts, sort]);
  const activeSelectedIds = selectedIds.filter((id) => visibleProducts.some((item) => item.variant.id === id));

  async function productAction(action: "duplicate" | "delete", variantId: string) {
    const response = await fetch("/api/products/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, variantId }) });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.message || "Product action failed.");
  }

  async function bulkDelete(variantIds: string[]) {
    const response = await fetch("/api/products/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-many", variantIds }) });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.message || "Products could not be deleted.");
  }

  function run(label: string, callback: () => Promise<void>, deletedIds: string[] = []) {
    startTransition(async () => {
      try {
        await callback();
        if (deletedIds.length) {
          setLocallyDeletedIds((current) => [...new Set([...current, ...deletedIds])]);
          setSelectedIds((current) => current.filter((id) => !deletedIds.includes(id)));
        }
        toast.success(label);
        router.refresh();
      } catch (error) {
        toast.error("Could not finish that action", { description: error instanceof Error ? error.message : "Try again." });
      }
    });
  }

  function toggleSelection(variantId: string) {
    setSelectedIds((current) => current.includes(variantId) ? current.filter((id) => id !== variantId) : [...current, variantId]);
  }

  function toggleSelectAll() {
    const visibleIds = sortedProducts.map((item) => item.variant.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : visibleIds);
  }

  function stopSelecting() {
    setSelecting(false);
    setSelectedIds([]);
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-700/45 bg-zinc-950/55 p-4 shadow-lg shadow-black/20 backdrop-blur">
        <div className="mr-auto">
          <p className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4 text-[#c8d2e6]" />Catalog controls</p>
          <p className="mt-1 text-xs text-muted-foreground">{mode === "empty" ? "No product records yet. Import your first item from the extension or sourcing workspace." : "Showing your saved product data."}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowDownAZ className="h-4 w-4 text-[#c8d2e6]" />
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="faust-field faust-focus px-3 py-2 text-sm text-foreground">
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 px-3 py-2 text-xs font-semibold text-[#f6f8ff] transition hover:border-slate-400/60 disabled:opacity-50"
          disabled={busy || !sortedProducts.length}
          onClick={() => selecting ? stopSelecting() : setSelecting(true)}
        >
          {selecting ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
          {selecting ? "Cancel selection" : "Select multiple"}
        </button>
      </section>

      {selecting && (
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-700/45 bg-zinc-950/55 p-4 shadow-lg shadow-black/20 backdrop-blur">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 px-3 py-2 text-xs font-semibold text-[#f6f8ff] transition hover:border-slate-400/60"
            onClick={toggleSelectAll}
          >
            {sortedProducts.length > 0 && sortedProducts.every((item) => selectedIds.includes(item.variant.id)) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            Select all visible
          </button>
          <p className="mr-auto text-sm text-muted-foreground">{activeSelectedIds.length} selected</p>
          <button
            type="button"
            disabled={busy || activeSelectedIds.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-[#56627f] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-950/30 transition hover:bg-[#66708d] disabled:opacity-50"
            onClick={() => run(`${activeSelectedIds.length} product${activeSelectedIds.length === 1 ? "" : "s"} removed from catalog`, () => bulkDelete(activeSelectedIds), activeSelectedIds)}
          >
            <Trash2 className="h-4 w-4" />
            Delete selected
          </button>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3" aria-label="Product cards">
        {sortedProducts.map((item) => (
          <div key={item.variant.id} className="space-y-3">
            {selecting && (
              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-700/45 bg-zinc-950/55 px-3 py-2 text-sm text-[#f6f8ff] transition hover:border-slate-400/60">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#56627f]"
                  checked={selectedIds.includes(item.variant.id)}
                  onChange={() => toggleSelection(item.variant.id)}
                />
                Select {item.variant.sku}
              </label>
            )}
            <ProductCard item={item} />
            <div className="flex flex-wrap justify-end gap-2 rounded-3xl border border-slate-700/35 bg-zinc-950/55 p-3">
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 px-3 py-1.5 text-xs font-semibold text-[#f6f8ff] transition hover:border-slate-400/60 disabled:opacity-50" onClick={() => run("Product duplicated", () => productAction("duplicate", item.variant.id))}><Copy className="h-3.5 w-3.5" />Duplicate</button>
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 px-3 py-1.5 text-xs font-semibold text-[#f6f8ff] transition hover:border-slate-400/60 disabled:opacity-50" onClick={() => run("Product removed from catalog", () => productAction("delete", item.variant.id), [item.variant.id])}><Trash2 className="h-3.5 w-3.5" />Delete</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
