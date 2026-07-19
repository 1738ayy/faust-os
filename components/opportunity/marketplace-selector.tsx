"use client";

import { Store } from "lucide-react";
import { getMarketplace, marketplaces } from "@/lib/marketplaces";
import { useOpportunity } from "./opportunity-provider";

export function MarketplaceSelector() {
  const { opportunity, analysis, updateMarketplace } = useOpportunity();
  if (!opportunity || !analysis) return null;
  const marketplace = getMarketplace(opportunity.listing.marketplaceId);

  return (
    <section className="rounded-3xl border border-red-950/45 bg-zinc-950/55 p-6 shadow-lg shadow-black/20 backdrop-blur">
      <div className="flex items-center gap-3"><Store className="h-6 w-6 text-red-300" /><div><h2 className="text-xl font-semibold">Marketplace</h2><p className="text-sm text-muted-foreground">Choose the first place you plan to list this product.</p></div></div>
      <select value={marketplace.id} onChange={(event) => updateMarketplace(event.target.value as typeof marketplace.id)} className="mt-6 h-12 w-full rounded-xl border border-red-950/45 bg-black/35 px-4">
        {marketplaces.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      <div className="mt-6 rounded-2xl border border-red-950/35 bg-black/25 p-4 text-sm">
        <div className="flex justify-between"><span>Selling fee</span><span>{(marketplace.sellingFeeRate * 100).toFixed(1)}%</span></div>
        <div className="mt-2 flex justify-between"><span>Payment processing</span><span>{(marketplace.paymentFeeRate * 100).toFixed(2)}%</span></div>
        <div className="mt-4 flex justify-between border-t border-red-950/35 pt-4 font-medium"><span>Calculated fees</span><span>${(analysis.marketplaceFees + analysis.paymentProcessingFees).toFixed(2)}</span></div>
      </div>
    </section>
  );
}
