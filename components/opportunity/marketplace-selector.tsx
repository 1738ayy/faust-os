"use client";

import { Store } from "lucide-react";
import { getMarketplace, marketplaces } from "@/lib/marketplaces";
import { getMarketplaceFeeProfile } from "@/lib/marketplace-fee-profiles";
import { useOpportunity } from "./opportunity-provider";

function baseLabel(base: string) {
  return base === "item_plus_shipping" ? "sale price + buyer shipping" : base === "item_price" ? "sale price" : base === "per_item" ? "per item" : base === "per_order" ? "per order" : "order total";
}

export function MarketplaceSelector() {
  const { opportunity, analysis, updateMarketplace, updateFeeOverride, resetFeeOverride } = useOpportunity();
  if (!opportunity || !analysis) return null;
  const marketplace = getMarketplace(opportunity.listing.marketplaceId);
  const profile = getMarketplaceFeeProfile(opportunity.listing.marketplaceId);
  const overrides = opportunity.feeAssumptions?.marketplaceId === marketplace.id ? opportunity.feeAssumptions.overrides || {} : {};

  return (
    <section className="rounded-3xl border border-slate-700/45 bg-zinc-950/55 p-6 shadow-lg shadow-black/20 backdrop-blur">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex items-center gap-3"><Store className="h-6 w-6 text-[#c8d2e6]" /><div><h2 className="text-xl font-semibold">Marketplace costs</h2><p className="text-sm text-muted-foreground">Selected marketplace controls the selling-cost profile automatically.</p></div></div>
        <select value={marketplace.id} onChange={(event) => updateMarketplace(event.target.value as typeof marketplace.id)} className="h-12 rounded-xl border border-slate-700/45 bg-black/35 px-4">
          {marketplaces.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </div>

      {analysis.feeProfileIncomplete ? <p className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">Marketplace fee profile incomplete. Faust is not assuming zero fees; configure temporary values before trusting profit.</p> : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-700/35 bg-black/25">
        <div className="grid grid-cols-[1.35fr_0.8fr_0.8fr_auto] gap-3 border-b border-slate-700/35 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span>Fee</span><span>Rate</span><span>Estimate</span><span />
        </div>
        {analysis.feeEstimates.map((fee) => {
          const current = overrides[fee.key] || {};
          return (
            <div key={fee.key} className="grid grid-cols-1 gap-3 border-b border-slate-700/35 px-4 py-4 last:border-0 md:grid-cols-[1.35fr_0.8fr_0.8fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{fee.label}</p>
                  {fee.optional ? <label className="inline-flex items-center gap-2 rounded-full border border-slate-700/50 bg-zinc-950/60 px-2.5 py-1 text-xs"><input type="checkbox" className="accent-[#66708d]" checked={fee.enabled} onChange={(event) => updateFeeOverride(fee.key, { ...current, enabled: event.target.checked })} />Use</label> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Applies to {baseLabel(fee.base)} · {fee.overridden ? "Custom for this opportunity" : `Marketplace default · ${profile.version}`}</p>
              </div>
              {fee.rate !== undefined ? (
                <label className="flex items-center gap-2 text-sm"><input type="number" min="0" max="100" step="0.01" value={((current.rate ?? fee.rate) * 100).toFixed(2)} onChange={(event) => updateFeeOverride(fee.key, { ...current, rate: (Number(event.target.value) || 0) / 100 })} className="faust-field faust-focus w-28 px-3 py-2" />%</label>
              ) : (
                <label className="flex items-center gap-2 text-sm">$<input type="number" min="0" step="0.01" value={(current.amount ?? fee.amount).toFixed(2)} onChange={(event) => updateFeeOverride(fee.key, { ...current, amount: Number(event.target.value) || 0 })} className="faust-field faust-focus w-28 px-3 py-2" /></label>
              )}
              <p className="font-heading text-xl font-semibold tabular-nums">${fee.amount.toFixed(2)}</p>
              <button type="button" disabled={!fee.overridden} onClick={() => resetFeeOverride(fee.key)} className="rounded-full border border-slate-700/60 px-3 py-2 text-xs font-semibold text-[#f6f8ff] transition hover:border-slate-400/50 disabled:opacity-35">Reset</button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="faust-card p-4"><p className="text-xs text-muted-foreground">Total selling costs</p><p className="mt-2 font-heading text-2xl font-semibold">${analysis.totalSellingCosts.toFixed(2)}</p></div>
        <div className="faust-card p-4"><p className="text-xs text-muted-foreground">Profit after fees</p><p className="mt-2 font-heading text-2xl font-semibold">${analysis.netProfit.toFixed(2)}</p></div>
        <div className="faust-card p-4"><p className="text-xs text-muted-foreground">Margin after fees</p><p className="mt-2 font-heading text-2xl font-semibold">{analysis.margin.toFixed(1)}%</p></div>
      </div>
    </section>
  );
}
