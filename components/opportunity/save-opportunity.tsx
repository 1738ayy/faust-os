"use client";

import { Bookmark } from "lucide-react";
import { SaveButton } from "./save-button";
import { useOpportunity } from "./opportunity-provider";

export function SaveOpportunity() {
  const { opportunity, analysis, updateNotes } = useOpportunity();
  if (!opportunity || !analysis) return null;
  return (
    <section className="rounded-3xl border border-red-950/45 bg-zinc-950/55 p-6 shadow-lg shadow-black/20 backdrop-blur">
      <div className="flex items-center gap-3"><Bookmark className="h-6 w-6 text-red-300" /><div><h2 className="text-xl font-semibold">Notes & save</h2><p className="text-sm text-muted-foreground">Capture sourcing context, then add the opportunity to your catalog.</p></div></div>
      <textarea rows={5} value={opportunity.notes} onChange={(event) => updateNotes(event.target.value)} placeholder="Add private sourcing notes, supplier context, or next steps…" className="mt-7 w-full resize-none rounded-xl border border-red-950/45 bg-black/35 p-3 transition focus:border-red-500/60" />
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-red-950/35 bg-black/25 p-4 text-sm"><span>Projected net profit</span><span className="text-lg font-semibold">${analysis.netProfit.toFixed(2)}</span></div>
      <div className="mt-6"><SaveButton /></div>
    </section>
  );
}
