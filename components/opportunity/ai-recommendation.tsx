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
  return <section className="rounded-3xl border border-sky-950/45 bg-zinc-950/55 p-5 shadow-lg shadow-black/20 backdrop-blur"><div className="flex items-center gap-3"><BrainCircuit className="h-6 w-6 text-sky-200" /><div><h2 className="text-lg font-semibold">Decision Summary</h2><p className="text-sm text-muted-foreground">What Faust recommends next.</p></div></div><div className="mt-5 flex items-center gap-3"><Icon className={`h-5 w-5 ${healthy ? "text-sky-100" : "text-amber-300"}`} /><h3 className={`text-lg font-bold ${healthy ? "text-sky-50" : "text-amber-200"}`}>{healthy ? "Ready for a test order" : "Needs review"}</h3></div><div className="mt-4 space-y-2 text-sm">{advice.map((item) => <div key={item} className="rounded-2xl border border-sky-950/35 bg-black/25 p-3">{item}</div>)}</div><div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4"><p className="text-sm text-muted-foreground">Suggested sale price</p><p className="mt-1 text-2xl font-bold">${suggestedPrice.toFixed(2)}</p></div></section>;
}
