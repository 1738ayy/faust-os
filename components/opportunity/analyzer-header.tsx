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
    <div className="rounded-3xl border border-red-950/45 bg-zinc-950/60 p-6 shadow-xl shadow-black/20 backdrop-blur">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Opportunity Analyzer</p>
          <h1 className="mt-2 text-3xl font-semibold">Review the buy before it becomes inventory.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Import the latest Superbuy/1688 scan, verify the captured fields, adjust landed costs, and compare marketplace economics before saving anything to Faust.
          </p>
        </div>
        <button onClick={importLatest} disabled={importing} className="flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 font-semibold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-60">
          <Download className="h-5 w-5" />
          {importing ? "Loading import..." : "Import latest scan"}
        </button>
      </div>
    </div>
  );
}
