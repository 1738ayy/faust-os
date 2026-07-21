"use client";

import { DollarSign, Percent, Target, TrendingUp } from "lucide-react";
import { CurrencyInput } from "./currency-input";
import { useOpportunity } from "./opportunity-provider";

export function FinancialResults() {
  const { opportunity, analysis, updateSalePrice } = useOpportunity();
  if (!opportunity || !analysis) return null;
  const cards = [
    ["Net profit", `$${analysis.netProfit.toFixed(2)}`, DollarSign, "text-[#edf3ff]"],
    ["Profit margin", `${analysis.margin.toFixed(1)}%`, Percent, "text-[#c8d2e6]"],
    ["Return on capital", `${analysis.roi.toFixed(1)}%`, TrendingUp, "text-[#edf3ff]"],
    ["Break-even price", `$${analysis.breakEvenPrice.toFixed(2)}`, Target, "text-amber-400"],
  ] as const;

  return (
    <section className="faust-surface p-6">
      <h2 className="text-xl font-semibold">Analysis</h2>
      <p className="mt-1 text-sm text-muted-foreground">Everything below updates as your price, costs, and business target margin change.</p>
      <div className="mt-7"><CurrencyInput label="Expected sale price" value={opportunity.salePrice} onChange={updateSalePrice} /></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map(([label, value, Icon, color]) => <div key={label} className="faust-card p-4"><Icon className={`mb-3 h-5 w-5 ${color}`} /><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></div>)}
      </div>
      <div className="faust-card mt-6 space-y-2 p-4 text-sm"><div className="flex justify-between"><span>Revenue</span><span>${analysis.revenue.toFixed(2)}</span></div><div className="flex justify-between"><span>Estimated selling costs</span><span>${analysis.totalSellingCosts.toFixed(2)}</span></div><div className="flex justify-between"><span>Gross profit</span><span>${analysis.grossProfit.toFixed(2)}</span></div><div className="flex justify-between"><span>Target margin</span><span>{analysis.targetMargin.toFixed(0)}%</span></div><div className="flex justify-between"><span>Target price</span><span>${analysis.recommendedPrice.toFixed(2)}</span></div><div className="flex justify-between font-medium"><span>Capital required</span><span>${analysis.capitalRequired.toFixed(2)}</span></div></div>
    </section>
  );
}
