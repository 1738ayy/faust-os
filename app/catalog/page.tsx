import { ArrowRight, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/navigation/app-layout";
import { EmptyState, PageHeader, PrimaryButton, SecondaryButton } from "@/components/faust/design-system";
import { CatalogWorkspace } from "@/components/products/catalog-workspace";
import { buildProductExperiences } from "@/lib/product-experience";
import { money } from "@/lib/business-calculations";
import { getOperatingData } from "@/services/operating-system/repository";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const data = await getOperatingData();
  const products = buildProductExperiences(data);
  const ready = products.filter((item) => item.readiness.score >= 85).length;
  const live = products.filter((item) => item.marketplaces.some((marketplace) => marketplace.status === "live")).length;
  const inventoryValue = products.reduce((sum, item) => sum + item.inventory.value, 0);
  const attention = products.filter((item) => item.intelligence.faustScore.score < 65 || item.intelligence.health.some((signal) => signal.status === "risk")).length;
  const readyToPublish = products.filter((item) => item.readiness.score >= 85 && !item.marketplaces.some((marketplace) => marketplace.status === "live")).length;
  const recommendedReorders = products.filter((item) => item.inventory.available <= item.purchasing.reorderPoint).length;
  const deployableProfit = products.reduce((sum, item) => sum + Math.max(0, item.finance.projectedRevenue - item.inventory.value), 0);
  const topProduct = [...products].sort((a, b) => b.intelligence.faustScore.score - a.intelligence.faustScore.score)[0];
  const attentionProduct = [...products].sort((a, b) => a.intelligence.faustScore.score - b.intelligence.faustScore.score)[0];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Products"
          title="Products"
          description="The living product command center for sourcing, inventory, listings, purchasing, finance, analytics, and AI."
          action={{ label: "Import product", href: "/sourcing" }}
        />

        {products.length === 0 ? (
          <div className="space-y-4">
            <EmptyState title="Your product library is empty" description="Import your first item from Superbuy or create an opportunity, then Faust will turn it into a product workspace." action={{ label: "Start sourcing", href: "/sourcing" }} />
            <section className="flex flex-wrap items-center justify-center gap-3 rounded-3xl border border-slate-700/45 bg-zinc-950/55 p-4 text-sm text-muted-foreground">
              <span>Start with your own data by importing from the browser extension or sourcing workspace.</span>
              <SecondaryButton href="/settings">Complete business profile</SecondaryButton>
            </section>
          </div>
        ) : (
          <>
            <section className="rounded-[2rem] border border-slate-700/45 bg-zinc-950/60 p-5 shadow-2xl shadow-black/25 backdrop-blur">
              <div className="grid gap-5 lg:grid-cols-[1.4fr_auto] lg:items-center">
                <div>
                  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#c8d2e6]"><Sparkles size={14} />Faust recommendation</p>
                  <h2 className="mt-3 text-2xl font-semibold">{attentionProduct && attentionProduct.intelligence.faustScore.score < 65 ? `Review ${attentionProduct.variant.sku} first.` : topProduct ? `Open ${topProduct.variant.sku} first.` : "Build your first product workspace."}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {attentionProduct && attentionProduct.intelligence.faustScore.score < 65 ? `${attentionProduct.intelligence.recommendation.situation} ${attentionProduct.intelligence.recommendation.expectedOutcome}` : topProduct ? `${topProduct.intelligence.recommendation.situation} Faust Score ${topProduct.intelligence.faustScore.score}/100 with ${topProduct.inventory.available} sellable unit(s).` : "Products become the hub for sourcing, listing, purchasing, inventory, finance, and AI."}
                  </p>
                </div>
                {(attentionProduct || topProduct) && <PrimaryButton href={(attentionProduct && attentionProduct.intelligence.faustScore.score < 65 ? attentionProduct : topProduct).href}>Open product<ArrowRight size={15} /></PrimaryButton>}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric label="Active products" value={String(products.length)} detail="living product workspaces" />
              <Metric label="Inventory value" value={money(inventoryValue)} detail="cash tied to stock" />
              <Metric label="Deployable profit" value={money(deployableProfit)} detail="projected upside from sellable stock" />
              <Metric label="Needs attention" value={String(attention)} detail="low score or health risk" />
              <Metric label="Ready to publish" value={String(readyToPublish)} detail="high readiness, not live yet" />
              <Metric label="Recommended reorders" value={String(recommendedReorders)} detail="at or below reorder point" />
              <Metric label="Ready products" value={String(ready)} detail="85%+ readiness" />
              <Metric label="Live products" value={String(live)} detail="published somewhere" />
            </section>

            <section className="flex flex-wrap items-center gap-3">
              <SecondaryButton href="/opportunity-analyzer">Analyze opportunity</SecondaryButton>
              <SecondaryButton href="/listings">Generate drafts</SecondaryButton>
              <SecondaryButton href="/purchasing">Plan reorder</SecondaryButton>
            </section>

            <CatalogWorkspace products={products} mode={data.mode} />
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="faust-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 font-heading text-3xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></article>;
}
