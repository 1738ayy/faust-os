"use client";
import { Award, Percent, ShieldCheck, TrendingUp } from "lucide-react";
import { getMarketplace } from "@/lib/marketplaces";
import { useOpportunity } from "./opportunity-provider";

export function OpportunityScore() {
  const { opportunity, analysis } = useOpportunity();
  if (!opportunity || !analysis) return null;
  const score = Math.max(0, Math.min(100, Math.round((Math.max(0, analysis.margin) * 0.65) + (Math.max(0, analysis.roi) * 0.12) + (opportunity.product.media.images.length ? 12 : 0) + (opportunity.product.weight ? 8 : 0))));
  const label = score >= 75 ? "Strong opportunity" : score >= 50 ? "Worth reviewing" : "Needs more data";
  const marketplace = getMarketplace(opportunity.listing.marketplaceId);
  return <section className="rounded-3xl border border-slate-700/45 bg-zinc-950/55 p-5 shadow-lg shadow-black/20 backdrop-blur"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Opportunity Score</h2><p className="text-sm text-muted-foreground">Data quality and margin signal.</p></div><Award className="h-6 w-6 text-[#c8d2e6]" /></div><div className="mt-5 flex justify-center"><div className="flex h-28 w-28 items-center justify-center rounded-full border-8 border-slate-400 shadow-lg shadow-slate-950/30"><div className="text-center"><p className="text-4xl font-bold">{score}</p><p className="text-xs text-muted-foreground">/100</p></div></div></div><p className="mt-4 text-center text-lg font-bold text-[#c8d2e6]">{label}</p><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span className="flex items-center gap-2"><Percent className="h-4 w-4 text-[#edf3ff]" />Margin</span><span>{analysis.margin.toFixed(1)}%</span></div><div className="flex justify-between"><span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#c8d2e6]" />ROI</span><span>{analysis.roi.toFixed(0)}%</span></div><div className="flex justify-between"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#c8d2e6]" />Marketplace</span><span>{marketplace.name}</span></div></div></section>;
}
