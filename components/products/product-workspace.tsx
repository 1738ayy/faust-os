import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, CircleAlert } from "lucide-react";
import { ActivityTimeline, MarketplaceBadge, PrimaryButton, StatusBadge } from "@/components/faust/design-system";
import { ProductImage } from "@/components/products/product-image";
import { ReadinessRing } from "@/components/products/readiness-ring";
import type { ProductExperience } from "@/lib/product-experience";
import { money } from "@/lib/business-calculations";
import { readinessLabel } from "@/lib/product-readiness";

export function ProductWorkspace({ item }: { item: ProductExperience }) {
  const live = item.marketplaces.filter((marketplace) => marketplace.status === "live").length;
  const needsReview = item.marketplaces.filter((marketplace) => marketplace.status === "rejected" || marketplace.status === "out_of_stock").length;

  return (
    <div className="space-y-6">
      <Link href="/catalog" className="inline-flex items-center gap-2 text-sm font-medium text-sky-100 hover:text-sky-50"><ArrowLeft size={15} />Back to Products</Link>

      <section className="relative overflow-hidden rounded-[2rem] border border-sky-950/45 bg-zinc-950/60 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,.28),transparent_28rem)]" />
        <div className="relative grid gap-6 p-5 lg:grid-cols-[340px_1fr] lg:p-7">
          <div className="overflow-hidden rounded-[1.7rem] border border-sky-950/45 bg-black/35">
            <ProductImage src={item.image} alt={item.product.title} className="aspect-square h-full w-full object-cover" fallbackClassName="aspect-square h-full w-full" />
          </div>
          <div className="flex flex-col justify-between gap-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-200">{item.variant.sku}</p>
                <h1 data-testid="page-title" className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight md:text-5xl">{item.product.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{item.variant.title} · {item.product.category} · {item.supplierName}</p>
              </div>
              <ReadinessRing readiness={item.readiness} size="lg" />
            </div>

            <div className="rounded-3xl border border-sky-950/45 bg-black/35 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-sky-100">Faust recommendation</p>
                  <h2 className="mt-2 text-2xl font-semibold">{item.intelligence.recommendation.situation}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.intelligence.recommendation.reasoning}</p>
                  <p className="mt-2 text-sm leading-6 text-sky-50">{item.intelligence.recommendation.expectedOutcome}</p>
                </div>
                <StatusBadge value={`${Math.round(item.intelligence.recommendation.confidence * 100)}% confidence`} />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <PrimaryButton href="#readiness">{item.ai.nextAction}<ArrowRight size={15} /></PrimaryButton>
                <Link href="#marketplaces" className="inline-flex items-center justify-center rounded-full border border-sky-950/60 bg-zinc-950/50 px-4 py-2 text-sm font-medium transition hover:border-sky-400/50">Review marketplaces</Link>
              </div>
            </div>

            <section className="grid gap-3 md:grid-cols-4">
              <HeroMetric label="Cost" value={money(item.finance.cost)} />
              <HeroMetric label="Revenue" value={money(item.finance.revenue)} />
              <HeroMetric label="Margin" value={`${item.finance.margin.toFixed(1)}%`} />
              <HeroMetric label="Inventory" value={`${item.inventory.available} available`} />
            </section>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Faust Score">
          <div className="grid gap-5 lg:grid-cols-[170px_1fr]">
            <div className="rounded-[2rem] border border-sky-950/45 bg-sky-950/15 p-5 text-center">
              <p className="text-sm text-muted-foreground">Overall product health</p>
              <p className="mt-3 font-heading text-6xl font-semibold tabular-nums text-sky-50">{item.intelligence.faustScore.score}</p>
              <p className="mt-2 text-sm font-medium text-sky-100">{item.intelligence.faustScore.label}</p>
            </div>
            <div>
              <p className="text-sm leading-6 text-muted-foreground">{item.intelligence.faustScore.explanation}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {item.intelligence.faustScore.components.map((component) => (
                  <div key={component.label} className="rounded-2xl border border-sky-950/35 bg-black/35 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <b className="text-sm">{component.label}</b>
                      <span className="font-heading text-lg font-semibold tabular-nums text-sky-50">{component.score}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{component.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="Product DNA">
          <div className="flex flex-wrap gap-2">
            {item.intelligence.dna.length ? item.intelligence.dna.map((dna) => <span key={dna.tag} className="rounded-full border border-sky-900/50 bg-sky-950/20 px-3 py-1.5 text-sm text-sky-50">{dna.tag}</span>) : <span className="text-sm text-muted-foreground">Faust needs more product history before DNA tags become reliable.</span>}
          </div>
          <div className="mt-4 grid gap-3">
            {item.intelligence.dna.map((dna) => <p key={dna.tag} className="rounded-2xl border border-sky-950/35 bg-black/35 p-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">{dna.tag}:</span> {dna.reason}</p>)}
          </div>
        </Panel>
      </section>

      <Panel title="Business health">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {item.intelligence.health.map((signal) => <HealthSignal key={signal.label} signal={signal} />)}
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Business summary">
          <div className="grid gap-3 md:grid-cols-3">
            <MiniMetric label="Selling price" value={money(item.finance.sellingPrice)} />
            <MiniMetric label="ROI" value={`${item.finance.roi.toFixed(1)}%`} />
            <MiniMetric label="Average selling price" value={money(item.finance.averageSellingPrice)} />
            <MiniMetric label="Cash invested" value={money(item.finance.cashInvested)} />
            <MiniMetric label="Cash returned" value={money(item.finance.cashReturned)} />
            <MiniMetric label="Projected revenue" value={money(item.finance.projectedRevenue)} />
          </div>
        </Panel>
        <Panel title="Marketplace presence" id="marketplaces">
          <div className="grid gap-3">
            {item.marketplaces.map((marketplace) => <MarketplaceRow key={marketplace.marketplace} marketplace={marketplace} />)}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{live} marketplace(s) live. {needsReview} marketplace(s) need review.</p>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Readiness checklist" id="readiness">
          <div className="grid gap-3 sm:grid-cols-2">
            {item.readiness.dimensions.map((dimension) => (
              <div className="rounded-2xl border border-sky-950/35 bg-black/35 p-3" key={dimension.key}>
                <div className="flex items-center gap-2">
                  {dimension.ready ? <CheckCircle2 className="h-4 w-4 text-sky-100" /> : <CircleAlert className="h-4 w-4 text-amber-300" />}
                  <b className="text-sm">{dimension.label}</b>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{dimension.detail}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Inventory and purchasing">
          <div className="grid gap-3 md:grid-cols-3">
            <MiniMetric label="On hand" value={String(item.inventory.onHand)} />
            <MiniMetric label="Incoming" value={String(item.inventory.incoming)} />
            <MiniMetric label="Reserved" value={String(item.inventory.reserved)} />
            <MiniMetric label="Damaged" value={String(item.inventory.damaged)} />
            <MiniMetric label="Quarantine" value={String(item.inventory.quarantined)} />
            <MiniMetric label="Inventory value" value={money(item.inventory.value)} />
          </div>
          <div className="mt-4 rounded-2xl border border-sky-950/35 bg-black/35 p-4 text-sm text-muted-foreground">
            Supplier: <span className="text-foreground">{item.supplierName}</span> · Lead time {item.purchasing.leadTime} · Reorder point {item.purchasing.reorderPoint} · Suggested reorder {item.purchasing.recommendedReorderQuantity}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="Photos">
          <div className="grid grid-cols-4 gap-2">
            {item.image ? <ProductImage src={item.image} alt="" className="col-span-2 aspect-square rounded-2xl object-cover" fallbackClassName="col-span-2 aspect-square rounded-2xl border border-dashed border-sky-950/45" /> : <div className="col-span-2 grid aspect-square place-items-center rounded-2xl border border-dashed border-sky-950/45 text-muted-foreground"><Camera className="h-7 w-7" /></div>}
            <PhotoPlaceholder label="Front" />
            <PhotoPlaceholder label="Detail" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Upload, crop, reorder, and mark image purpose comes next; source images stay preserved separately.</p>
        </Panel>
        <Panel title="Analytics">
          <Row label="Units sold" value={item.analytics.unitsSold} />
          <Row label="Sell-through" value={`${item.analytics.sellThrough.toFixed(1)}%`} />
          <Row label="Returns" value={item.analytics.returns} />
          <Row label="Best marketplace" value={item.analytics.bestMarketplace} />
          <Row label="Velocity" value={item.analytics.velocityLabel} />
        </Panel>
        <Panel title="Related products">
          <div className="grid gap-3">
            {item.intelligence.relationships.length ? item.intelligence.relationships.map((relationship) => (
              <Link key={`${relationship.type}-${relationship.href}`} href={relationship.href} className="rounded-2xl border border-sky-950/35 bg-black/35 p-3 transition hover:border-sky-400/45">
                <p className="text-sm font-medium">{relationship.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{relationship.detail}</p>
              </Link>
            )) : <p className="text-sm text-muted-foreground">No strong product relationships are proven yet. Shared supplier, category, marketplace, and pricing patterns will appear here as the catalog grows.</p>}
          </div>
        </Panel>
      </section>

      <details className="faust-surface p-5">
        <summary className="cursor-pointer text-xl font-semibold">Product timeline</summary>
        <div className="mt-4">
          <ActivityTimeline items={item.timeline.map((event) => ({ id: event.id, title: event.title, detail: event.detail, at: new Date(event.at).toLocaleString() }))} />
        </div>
      </details>

      <Panel title="Advanced">
        <details className="rounded-2xl border border-sky-950/35 bg-black/35 p-4 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Technical information and diagnostics</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Row label="Product ID" value={item.product.id} />
            <Row label="Variant ID" value={item.variant.id} />
            <Row label="Source URL" value={item.product.sourceUrl ? <Link className="text-sky-100" href={item.product.sourceUrl}>Open source</Link> : "Not captured"} />
            <Row label="Status" value={readinessLabel(item.readiness.status)} />
          </div>
        </details>
      </Panel>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-sky-950/35 bg-black/35 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{value}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-sky-950/35 bg-black/35 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-heading text-xl font-semibold tabular-nums">{value}</p></div>;
}

function Panel({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return <section id={id} className="faust-surface p-5"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex justify-between gap-4 border-b border-sky-950/35 py-3 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><span className="text-right">{value}</span></div>;
}

function HealthSignal({ signal }: { signal: ProductExperience["intelligence"]["health"][number] }) {
  const tone = signal.status === "strong" ? "text-sky-50" : signal.status === "healthy" ? "text-emerald-200" : signal.status === "watch" ? "text-amber-200" : signal.status === "risk" ? "text-sky-100" : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-sky-950/35 bg-black/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{signal.label}</p>
        <span className={`text-xs capitalize ${tone}`}>{signal.status}</span>
      </div>
      <p className="mt-3 font-heading text-xl font-semibold tabular-nums">{signal.value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{signal.meaning}</p>
    </div>
  );
}

function MarketplaceRow({ marketplace }: { marketplace: ProductExperience["marketplaces"][number] }) {
  const tone = marketplace.status === "live" ? "text-sky-50" : marketplace.status === "rejected" || marketplace.status === "out_of_stock" ? "text-amber-200" : "text-muted-foreground";
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-950/35 bg-black/35 p-3"><MarketplaceBadge marketplace={marketplace.marketplace} /><span className={`text-sm capitalize ${tone}`}>{marketplace.status.replaceAll("_", " ")}</span></div>;
}

function PhotoPlaceholder({ label }: { label: string }) {
  return <div className="grid aspect-square place-items-center rounded-2xl border border-dashed border-sky-950/45 text-xs text-muted-foreground">{label}</div>;
}
