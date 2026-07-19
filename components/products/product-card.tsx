import Link from "next/link";
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
    <Link
      href={item.href}
      className="group block rounded-[2rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/25"
      aria-label={`Open ${item.product.title} product workspace`}
    >
      <article className="relative min-h-[560px] overflow-hidden rounded-[2rem] border border-red-950/45 bg-zinc-950/70 shadow-2xl shadow-black/25 backdrop-blur transition duration-300 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:shadow-red-950/20">
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-red-950/30 to-transparent" />
        <div className="relative h-64 overflow-hidden bg-black/35">
          <ProductImage src={item.image} alt={item.product.title} className="h-full w-full object-cover transition duration-500 motion-safe:group-hover:scale-105" fallbackClassName="h-full w-full" />
          <div className="absolute right-4 top-4"><ReadinessRing readiness={item.readiness} size="sm" /></div>
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2">
            <StatusBadge value={readinessLabel(item.readiness.status)} />
            <span className="rounded-full border border-red-950/45 bg-black/50 px-2.5 py-1 text-xs text-red-100">Faust Score {item.intelligence.faustScore.score}</span>
          </div>
        </div>

        <div className="relative p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-red-300">{item.variant.sku}</p>
          <h2 className="mt-2 line-clamp-2 text-xl font-semibold">{item.product.title}</h2>
          <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{item.supplierName}</p>

          <div className="mt-5 rounded-2xl border border-red-950/35 bg-black/35 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-red-200">Product health</p>
              <span className="rounded-full bg-red-950/35 px-2 py-1 text-[11px] text-red-100">{item.intelligence.faustScore.label}</span>
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
            {item.intelligence.dna.slice(0, 3).map((dna) => <span key={dna.tag} className="rounded-full border border-red-950/35 bg-red-950/15 px-2.5 py-1 text-[11px] text-red-100">{dna.tag}</span>)}
          </div>

          <div className="mt-5 rounded-2xl border border-red-950/35 bg-black/35 p-3">
            <p className="text-xs font-medium text-red-200">Faust says</p>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{item.intelligence.recommendation.situation}</p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{liveMarketplaces} live · {draftMarketplaces} draft/pending</span>
            <span className="inline-flex items-center gap-1 font-medium text-red-200">Open workspace <ArrowRight size={14} /></span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function CardMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-2xl border border-red-950/35 bg-black/35 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 font-heading text-lg font-semibold tabular-nums ${accent ? "text-red-100" : ""}`}>{value}</p></div>;
}
