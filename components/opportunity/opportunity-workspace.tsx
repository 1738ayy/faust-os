"use client";

import { ArrowDownToLine } from "lucide-react";
import { AnalyzerHeader } from "./analyzer-header";
import { CostBreakdown } from "./cost-breakdown";
import { FinancialResults } from "./financial-results";
import { MarketplaceSelector } from "./marketplace-selector";
import { ProductInformation } from "./product-information";
import { ProductPreview } from "./product-preview";
import { SaveOpportunity } from "./save-opportunity";
import { OpportunityScore } from "./opportunity-score";
import { AiRecommendation } from "./ai-recommendation";
import { useOpportunity } from "./opportunity-provider";

export function OpportunityWorkspace() {
  const { opportunity } = useOpportunity();
  return <div className="space-y-8"><AnalyzerHeader />
    {!opportunity ? <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center"><ArrowDownToLine className="mx-auto h-10 w-10 text-violet-400" /><h2 className="mt-5 text-xl font-semibold">Start from Superbuy</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Use the Faust Chrome extension on a Superbuy product page, then choose Import Superbuy above to create this opportunity.</p></div> : <>
      <div className="grid gap-8 lg:grid-cols-2"><ProductInformation /><ProductPreview /></div>
      <MarketplaceSelector />
      <div className="grid gap-8 lg:grid-cols-2"><CostBreakdown /><FinancialResults /></div>
      <div className="grid gap-8 lg:grid-cols-2"><OpportunityScore /><AiRecommendation /></div>
      <SaveOpportunity />
    </>}
  </div>;
}
