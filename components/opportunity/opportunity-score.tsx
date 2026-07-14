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
  return <section className="rounded-xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Opportunity Score</h2><p className="text-sm text-muted-foreground">A transparent score based on the data in this workspace.</p></div><Award className="h-7 w-7 text-violet-400" /></div><div className="mt-8 flex justify-center"><div className="flex h-40 w-40 items-center justify-center rounded-full border-8 border-violet-500"><div className="text-center"><p className="text-5xl font-bold">{score}</p><p className="text-sm text-muted-foreground">/100</p></div></div></div><p className="mt-6 text-center text-xl font-bold text-violet-400">{label}</p><div className="mt-8 space-y-4"><div className="flex justify-between"><span className="flex items-center gap-2"><Percent className="h-5 w-5 text-sky-400" />Margin</span><span>{analysis.margin.toFixed(1)}%</span></div><div className="flex justify-between"><span className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-400" />ROI</span><span>{analysis.roi.toFixed(0)}%</span></div><div className="flex justify-between"><span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-400" />Marketplace</span><span>{marketplace.name}</span></div></div></section>;
}
