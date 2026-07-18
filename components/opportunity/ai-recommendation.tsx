"use client";
import { BrainCircuit, CircleCheck, TriangleAlert } from "lucide-react";
import { useOpportunity } from "./opportunity-provider";

export function AiRecommendation() {
  const { opportunity, analysis } = useOpportunity();
  if (!opportunity || !analysis) return null;
  const healthy = analysis.margin >= 50 && analysis.netProfit > 0;
  const suggestedPrice = analysis.breakEvenPrice > 0 ? analysis.breakEvenPrice * 1.7 : 0;
  const Icon = healthy ? CircleCheck : TriangleAlert;
  const advice = healthy ? ["Projected margin meets the target range.", "Cost structure supports a small test order.", "Review competition and demand before scaling."] : ["Set a sale price before deciding.", "Review shipping and marketplace fees.", "Aim for a stronger margin before ordering inventory."];
  return <section className="rounded-3xl border border-red-950/45 bg-zinc-950/55 p-6 shadow-lg shadow-black/20 backdrop-blur"><div className="flex items-center gap-3"><BrainCircuit className="h-7 w-7 text-red-300" /><div><h2 className="text-xl font-semibold">Decision Summary</h2><p className="text-sm text-muted-foreground">Rule-based guidance until an AI provider is connected.</p></div></div><div className="mt-8 flex items-center gap-3"><Icon className={`h-6 w-6 ${healthy ? "text-emerald-400" : "text-yellow-400"}`} /><h3 className={`text-xl font-bold ${healthy ? "text-emerald-400" : "text-yellow-400"}`}>{healthy ? "Ready for a test order" : "Needs review"}</h3></div><div className="mt-6 space-y-3">{advice.map((item) => <div key={item} className="rounded-2xl border border-red-950/35 bg-black/25 p-3">{item}</div>)}</div><div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-4"><p className="text-sm text-muted-foreground">Suggested sale price</p><p className="mt-2 text-2xl font-bold">${suggestedPrice.toFixed(2)}</p></div></section>;
}
