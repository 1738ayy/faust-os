"use client";
/* eslint-disable @next/next/no-img-element -- queued source images come from Superbuy/1688 hosts. */

import { Download, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useOpportunity } from "./opportunity-provider";
import type { SuperbuyProduct } from "@/types/superbuy-product";

export function AnalyzerHeader() {
  const { importSuperbuyProduct } = useOpportunity();
  const [importing, setImporting] = useState(false);
  const [queue, setQueue] = useState<ImportQueueItem[]>([]);
  const loadedFromExtension = useRef(false);

  const localHandoffProduct = useCallback(() => {
    try {
      const raw = window.localStorage.getItem("faust.latestExtensionScan");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { product?: SuperbuyProduct };
      return parsed.product || null;
    } catch {
      return null;
    }
  }, []);

  const waitForLocalHandoff = useCallback(async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const product = localHandoffProduct();
      if (product) return product;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    return null;
  }, [localHandoffProduct]);

  const loadQueue = useCallback(async () => {
    const response = await fetch("/api/import-queue", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setQueue(data.queue || []);
  }, []);

  const importLatest = useCallback(async (options: { waitForExtensionHandoff?: boolean } = {}) => {
    setImporting(true);
    try {
      const response = await fetch("/api/current-product", { cache: "no-store" });
      const data = await response.json();
      let product: SuperbuyProduct | null = response.ok ? data.product as SuperbuyProduct : null;
      if (!product) product = options.waitForExtensionHandoff ? await waitForLocalHandoff() : localHandoffProduct();
      if (!product) throw new Error(data.message ?? "No imported Superbuy product found.");
      importSuperbuyProduct(product);
      await loadQueue();
      toast.success("Product ready for review", { description: response.ok ? "Faust loaded the latest saved scan." : "Faust recovered the scan from the extension handoff." });
    } catch (error) {
      toast.error("Import unavailable", { description: error instanceof Error ? error.message : "Unable to load the imported product." });
    } finally {
      setImporting(false);
    }
  }, [importSuperbuyProduct, loadQueue, localHandoffProduct, waitForLocalHandoff]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue(), 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (loadedFromExtension.current || params.get("source") !== "extension-import") return;
    loadedFromExtension.current = true;
    const timer = window.setTimeout(() => void importLatest({ waitForExtensionHandoff: true }), 0);
    return () => window.clearTimeout(timer);
  }, [importLatest]);

  return (
    <div className="rounded-3xl border border-sky-950/45 bg-zinc-950/60 p-6 shadow-xl shadow-black/20 backdrop-blur">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Opportunity Analyzer</p>
          <h1 className="mt-2 text-3xl font-semibold">Review the buy before it becomes inventory.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Import the latest Superbuy/1688 scan, verify the captured fields, adjust landed costs, and compare marketplace economics before saving anything to Faust.
          </p>
        </div>
        <button onClick={() => void importLatest()} disabled={importing} className="flex items-center justify-center gap-2 rounded-full bg-sky-500 px-5 py-3 font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60">
          <Download className="h-5 w-5" />
          {importing ? "Loading import..." : "Import latest scan"}
        </button>
      </div>
      <div className="mt-6 rounded-2xl border border-sky-950/35 bg-black/25 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Import Queue</p>
            <h2 className="mt-1 text-lg font-semibold">Products waiting for review</h2>
          </div>
          <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-50">{queue.length} scan{queue.length === 1 ? "" : "s"}</span>
        </div>
        {queue.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {queue.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-2xl border border-sky-950/35 bg-zinc-950/55 p-3">
                <div className="flex gap-3">
                  {item.image ? <img src={item.image} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-black/35"><Sparkles className="h-5 w-5 text-sky-200" /></div>}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.supplier}</p>
                    <p className="mt-1 text-xs text-sky-100">{item.status === "product_created" ? `Created · ${item.convertedVariants} SKU variant(s)` : "Ready for analysis"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-muted-foreground">Use the Faust extension on a Superbuy or 1688 product page. Imported scans will appear here automatically.</p>}
      </div>
    </div>
  );
}

type ImportQueueItem = {
  id: string;
  title: string;
  supplier: string;
  source: string;
  sourceUrl: string;
  image?: string;
  imageCount: number;
  variantCount: number;
  price?: number;
  importedAt: string;
  status: "ready_for_review" | "product_created";
  productId?: string;
  convertedVariants: number;
};
