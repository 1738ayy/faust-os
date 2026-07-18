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

function SourceDataReview() {
  const { opportunity } = useOpportunity();
  if (!opportunity) return null;
  const product = opportunity.product;
  const source = product.source;
  const checks = [
    ["Title", product.name],
    ["Supplier/store", product.supplier.storeName || product.supplier.name],
    ["Source URL", product.sourcing.original1688Url || product.sourcing.superbuyUrl],
    ["Price", typeof product.sourcing.sourcePrice === "number" ? `$${product.sourcing.sourcePrice.toFixed(2)}` : ""],
    ["Weight", product.weight || product.shippingWeight],
    ["Images", String(product.media.images.length)],
    ["Variants", String(product.variants.length)],
  ] as const;
  const missing = checks.filter(([, value]) => !value || value === "0");

  return (
    <section className="rounded-3xl border border-red-950/45 bg-zinc-950/60 p-5 shadow-lg shadow-black/20 backdrop-blur">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Source data review</p>
          <h2 className="mt-2 text-xl font-semibold">Captured product facts</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review this before saving. Faust should not pretend a source scan is clean if Superbuy/1688 gave us modal text, missing weight, weak supplier data, or no usable variant rows.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${missing.length ? "bg-amber-400/10 text-amber-200" : "bg-emerald-400/10 text-emerald-200"}`}>
          {missing.length ? `${missing.length} field${missing.length === 1 ? "" : "s"} need review` : "Ready to analyze"}
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {checks.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-background/45 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-sm font-medium">{value || "Needs review"}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/45 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Original source</p>
          <a className="mt-2 block truncate text-sm font-medium text-emerald-300" href={product.sourcing.original1688Url || product.sourcing.superbuyUrl}>{source.original1688Url || source.superbuyUrl}</a>
        </div>
        <div className="rounded-2xl border border-border bg-background/45 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Stock / MOQ</p>
          <p className="mt-2 text-sm font-medium">{product.sourcing.stock ?? "unknown"} units · MOQ {product.sourcing.minimumOrderQuantity ?? "unknown"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/45 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Extension note</p>
          <p className="mt-2 text-sm text-muted-foreground">{source.notes || "No scanner note was provided."}</p>
        </div>
      </div>
    </section>
  );
}

export function OpportunityWorkspace() {
  const { opportunity } = useOpportunity();
  return <div className="space-y-8"><AnalyzerHeader />
    {!opportunity ? <div className="rounded-3xl border border-dashed border-red-500/35 bg-zinc-950/55 p-12 text-center shadow-xl shadow-black/20 backdrop-blur"><ArrowDownToLine className="mx-auto h-10 w-10 text-red-300" /><h2 className="mt-5 text-xl font-semibold">Start from Superbuy</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Use the Faust Chrome extension on a Superbuy product page, then choose Import Superbuy above to create this opportunity.</p></div> : <>
      <SourceDataReview />
      <div className="grid gap-8 lg:grid-cols-2"><ProductInformation /><ProductPreview /></div>
      <MarketplaceSelector />
      <div className="grid gap-8 lg:grid-cols-2"><CostBreakdown /><FinancialResults /></div>
      <div className="grid gap-8 lg:grid-cols-2"><OpportunityScore /><AiRecommendation /></div>
      <SaveOpportunity />
    </>}
  </div>;
}
