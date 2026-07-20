"use client";

import { CurrencyInput } from "./currency-input";
import { useOpportunity } from "./opportunity-provider";
import type { CostKey } from "@/types/cost";

const editableCosts: CostKey[] = ["product", "domesticShipping", "internationalShipping", "packaging", "advertising", "taxes", "storage", "warehouse", "returns", "miscellaneous"];

export function CostBreakdown() {
  const { opportunity, analysis, updateCost, updateCostNotes } = useOpportunity();
  if (!opportunity || !analysis) return null;

  return (
    <section className="rounded-3xl border border-slate-700/45 bg-zinc-950/55 p-6 shadow-lg shadow-black/20 backdrop-blur">
      <h2 className="text-xl font-semibold">Costs</h2>
      <p className="mt-1 text-sm text-muted-foreground">Enter only the costs you know. Marketplace and payment fees are calculated automatically.</p>
      <div className="mt-7 space-y-5">
        {editableCosts.map((key) => {
          const cost = opportunity.costs[key];
          return <div key={key} className="rounded-2xl border border-slate-700/40 bg-black/25 p-3">
            <CurrencyInput label={cost.label} value={cost.amount} onChange={(amount) => updateCost(key, amount)} />
            <input value={cost.notes ?? ""} onChange={(event) => updateCostNotes(key, event.target.value)} placeholder="Cost note (optional)" className="mt-3 w-full border-0 bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/60" />
          </div>;
        })}
        <div className="rounded-xl bg-muted/40 p-4 text-sm">
          <div className="flex justify-between"><span>Marketplace fees</span><span>${analysis.marketplaceFees.toFixed(2)}</span></div>
          <div className="mt-2 flex justify-between"><span>Payment processing</span><span>${analysis.paymentProcessingFees.toFixed(2)}</span></div>
        </div>
      </div>
      <div className="mt-7 rounded-2xl bg-[#56627f] p-5 text-white shadow-lg shadow-slate-950/30"><div className="flex justify-between"><span className="text-lg font-medium">Total cost</span><span className="text-3xl font-bold">${analysis.totalCost.toFixed(2)}</span></div></div>
    </section>
  );
}
