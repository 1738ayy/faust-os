"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useOpportunity } from "./opportunity-provider";
import type { SuperbuyProduct } from "@/types/superbuy-product";

export function AnalyzerHeader() {
  const { importSuperbuyProduct } = useOpportunity();
  const [importing, setImporting] = useState(false);

  async function importLatest() {
    setImporting(true);
    try {
      const response = await fetch("/api/current-product", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "No imported Superbuy product found.");
      importSuperbuyProduct(data.product as SuperbuyProduct);
      toast.success("Superbuy product imported", { description: "Your opportunity workspace is ready." });
    } catch (error) {
      toast.error("Import unavailable", { description: error instanceof Error ? error.message : "Unable to load the imported product." });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-violet-400">Sourcing workspace</p>
          <h1 className="mt-1 text-2xl font-bold">New opportunity</h1>
          <p className="mt-1 text-sm text-muted-foreground">Import a Superbuy product, review its costs, then save it to your catalog.</p>
        </div>
        <button onClick={importLatest} disabled={importing} className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-medium text-white transition hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60">
          <Download className="h-5 w-5" />
          {importing ? "Loading import…" : "Import Superbuy"}
        </button>
      </div>
    </div>
  );
}
