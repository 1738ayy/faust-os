import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { MarketplaceBadge, StatusBadge } from "@/components/faust/design-system";
import { ReadinessRing } from "@/components/products/readiness-ring";
import { ProductImage } from "@/components/products/product-image";
import type { ProductExperience } from "@/lib/product-experience";
import { money } from "@/lib/business-calculations";
import { readinessLabel } from "@/lib/product-readiness";

export function ProductCard({ item }: { item: ProductExperience }) {
  const liveMarketplaces = item.marketplaces.filter((marketplace) => marketplace.status === "live").length;
  const draftMarketplaces = item.marketplaces.filter((marketplace) => marketplace.status === "draft" || marketplace.status === "pending").length;
  const primaryHealth = item.intelligence.health[0];

  return (
    <article className="group relative min-h-[560px] overflow-hidden rounded-[2rem] border border-slate-700/45 bg-zinc-950/70 shadow-2xl shadow-black/25 backdrop-blur transition duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-slate-950/20" style={{ contentVisibility: "auto", containIntrinsicSize: "560px" } as CSSProperties}>
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-slate-900/30 to-transparent" />
        <div className="relative h-64 overflow-hidden bg-black/35">
          <Link href={item.href} className="block h-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f9bb8]/25" aria-label={`Open ${item.product.title} product workspace`}>
            <ProductImage src={item.image} alt={item.product.title} className="h-full w-full object-cover transition duration-500 motion-safe:group-hover:scale-105" fallbackClassName="h-full w-full" />
          </Link>
          <div className="absolute right-4 top-4"><ReadinessRing readiness={item.readiness} size="sm" recommendation={item.intelligence.recommendation.situation} confidence={item.intelligence.recommendation.confidence} /></div>
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2">
            <StatusBadge value={readinessLabel(item.readiness.status)} />
            <span className="rounded-full border border-slate-700/45 bg-black/50 px-2.5 py-1 text-xs text-[#f6f8ff]">Faust Score {item.intelligence.faustScore.score}</span>
          </div>
        </div>

        <div className="relative p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#c8d2e6]">{item.variant.sku}</p>
          <h2 className="mt-2 line-clamp-2 text-xl font-semibold"><Link href={item.href} className="rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f9bb8]/25">{item.product.title}</Link></h2>
          <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{item.supplierName}</p>

          <div className="mt-5 rounded-2xl border border-slate-700/35 bg-black/35 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-[#edf3ff]">Product health</p>
              <span className="rounded-full bg-slate-800/35 px-2 py-1 text-[11px] text-[#f6f8ff]">{item.intelligence.faustScore.label}</span>
            </div>
            <p className="mt-2 text-sm font-medium">{primaryHealth ? `${primaryHealth.label}: ${primaryHealth.status}` : "Health: learning"}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{primaryHealth?.meaning || "Faust will become more confident as the product gathers history."}</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <CardMetric label="Margin" value={`${item.finance.margin.toFixed(1)}%`} />
            <CardMetric label="Projected profit" value={money(item.finance.profit || item.finance.sellingPrice - item.finance.cost)} accent />
            <CardMetric label="Inventory" value={`${item.inventory.available} sellable`} />
            <CardMetric label="Confidence" value={`${Math.round(item.intelligence.recommendation.confidence * 100)}%`} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {item.marketplaces.slice(0, 5).map((market) => <MarketplaceBadge key={market.marketplace} marketplace={market.marketplace} />)}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {item.intelligence.dna.slice(0, 3).map((dna) => <span key={dna.tag} className="rounded-full border border-slate-700/35 bg-slate-800/15 px-2.5 py-1 text-[11px] text-[#f6f8ff]">{dna.tag}</span>)}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-700/35 bg-black/35 p-3">
            <p className="text-xs font-medium text-[#edf3ff]">Faust says</p>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{item.intelligence.recommendation.situation}</p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{liveMarketplaces} live · {draftMarketplaces} draft/pending</span>
            <Link href={item.href} className="inline-flex items-center gap-1 rounded-lg font-medium text-[#edf3ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f9bb8]/25">Open workspace <ArrowRight size={14} /></Link>
          </div>
        </div>
      </article>
  );
}

function CardMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-2xl border border-slate-700/35 bg-black/35 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 font-heading text-lg font-semibold tabular-nums ${accent ? "text-[#f6f8ff]" : ""}`}>{value}</p></div>;
}
