"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Atom, CheckCircle2, CircleAlert, Edit3, GitBranch, Save, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { ActivityTimeline, MarketplaceBadge, PrimaryButton, StatusBadge } from "@/components/faust/design-system";
import { ProductImage } from "@/components/products/product-image";
import { ProductImageManager } from "@/components/products/product-image-manager";
import { ReadinessRing } from "@/components/products/readiness-ring";
import type { ProductExperience } from "@/lib/product-experience";
import { money } from "@/lib/business-calculations";
import { readinessLabel } from "@/lib/product-readiness";

export function ProductWorkspace({ item }: { item: ProductExperience }) {
  const live = item.marketplaces.filter((marketplace) => marketplace.status === "live").length;
  const needsReview = item.marketplaces.filter((marketplace) => marketplace.status === "rejected" || marketplace.status === "out_of_stock").length;
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-6">
      <Link href="/catalog" className="inline-flex items-center gap-2 text-sm font-medium text-[#edf3ff] hover:text-[#f6f8ff]"><ArrowLeft size={15} />Back to Products</Link>

      <section className="relative overflow-hidden rounded-[2rem] border border-slate-700/45 bg-zinc-950/60 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(86,98,127,.28),transparent_28rem)]" />
        <div className="relative grid gap-6 p-5 lg:grid-cols-[340px_1fr] lg:p-7">
          <div className="overflow-hidden rounded-[1.7rem] border border-slate-700/45 bg-black/35">
            <ProductImage src={item.image} alt={item.product.title} className="aspect-square h-full w-full object-cover" fallbackClassName="aspect-square h-full w-full" />
          </div>
          <div className="flex flex-col justify-between gap-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#c8d2e6]">{item.variant.sku}</p>
                <h1 data-testid="page-title" className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight md:text-5xl">{item.product.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{item.variant.title} · {item.product.category} · {item.supplierName}</p>
              </div>
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-zinc-950/60 px-4 py-2 text-sm font-semibold text-[#f6f8ff] transition hover:border-slate-400/60"><Edit3 size={15} />Edit Product</button>
                <ReadinessRing readiness={item.readiness} size="lg" recommendation={item.intelligence.recommendation.situation} confidence={item.intelligence.recommendation.confidence} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700/45 bg-black/35 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#edf3ff]">Faust recommendation</p>
                  <h2 className="mt-2 text-2xl font-semibold">{item.intelligence.recommendation.situation}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.intelligence.recommendation.reasoning}</p>
                  <p className="mt-2 text-sm leading-6 text-[#f6f8ff]">{item.intelligence.recommendation.expectedOutcome}</p>
                </div>
                <StatusBadge value={`${Math.round(item.intelligence.recommendation.confidence * 100)}% confidence`} />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <PrimaryButton href="#readiness">{item.ai.nextAction}<ArrowRight size={15} /></PrimaryButton>
                <Link href="#marketplaces" className="inline-flex items-center justify-center rounded-full border border-slate-700/60 bg-zinc-950/50 px-4 py-2 text-sm font-medium transition hover:border-slate-400/50">Review marketplaces</Link>
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

      <section className="grid items-start gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Faust Score">
          <div className="grid gap-5 lg:grid-cols-[170px_1fr]">
            <div className="rounded-[2rem] border border-slate-700/45 bg-slate-800/15 p-5 text-center">
              <p className="text-sm text-muted-foreground">Overall product health</p>
              <p className="mt-3 font-heading text-6xl font-semibold tabular-nums text-[#f6f8ff]">{item.intelligence.faustScore.score}</p>
              <p className="mt-2 text-sm font-medium text-[#edf3ff]">{item.intelligence.faustScore.label}</p>
            </div>
            <div>
              <p className="text-sm leading-6 text-muted-foreground">{item.intelligence.faustScore.explanation}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {item.intelligence.faustScore.components.map((component) => (
                  <div key={component.label} className="rounded-2xl border border-slate-700/35 bg-black/35 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <b className="text-sm">{component.label}</b>
                      <span className="font-heading text-lg font-semibold tabular-nums text-[#f6f8ff]">{component.score}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{component.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="Photos">
          <PersistentProductImages item={item} />
        </Panel>
      </section>

      <ProductDnaCapsule item={item} />

      <Panel title="Business health">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {item.intelligence.health.map((signal) => <HealthSignal key={signal.label} signal={signal} />)}
        </div>
      </Panel>

      <section className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Panel title="Business summary">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <MiniMetric label="Selling price" value={money(item.finance.sellingPrice)} />
              <MiniMetric label="ROI" value={`${item.finance.roi.toFixed(1)}%`} />
              <MiniMetric label="Average selling price" value={money(item.finance.averageSellingPrice)} />
              <MiniMetric label="Cash invested" value={money(item.finance.cashInvested)} />
              <MiniMetric label="Cash returned" value={money(item.finance.cashReturned)} />
              <MiniMetric label="Projected revenue" value={money(item.finance.projectedRevenue)} />
            </div>
          </Panel>
          <Panel title="Readiness checklist" id="readiness">
            <div className="grid gap-3 sm:grid-cols-2">
              {item.readiness.dimensions.map((dimension) => (
                <div className="rounded-2xl border border-slate-700/35 bg-black/35 p-3" key={dimension.key}>
                  <div className="flex items-center gap-2">
                    {dimension.ready ? <CheckCircle2 className="h-4 w-4 text-[#edf3ff]" /> : <CircleAlert className="h-4 w-4 text-amber-300" />}
                    <b className="text-sm">{dimension.label}</b>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{dimension.detail}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Analytics">
            <Row label="Units sold" value={item.analytics.unitsSold} />
            <Row label="Sell-through" value={`${item.analytics.sellThrough.toFixed(1)}%`} />
            <Row label="Returns" value={item.analytics.returns} />
            <Row label="Best marketplace" value={item.analytics.bestMarketplace} />
            <Row label="Velocity" value={item.analytics.velocityLabel} />
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Marketplace presence" id="marketplaces">
            <div className="grid gap-3">
              {item.marketplaces.map((marketplace) => <MarketplaceRow key={marketplace.marketplace} marketplace={marketplace} />)}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{live} marketplace(s) live. {needsReview} marketplace(s) need review.</p>
          </Panel>
          <Panel title="Inventory plan">
            <p className="mb-4 text-sm leading-6 text-muted-foreground">Track this SKU from Superbuy order to incoming stock, available units, customer commitments, and the next buying move.</p>
            <div className="grid gap-3 md:grid-cols-2">
              <MiniMetric label="On hand" value={String(item.inventory.onHand)} />
              <MiniMetric label="Ordered / incoming" value={String(item.inventory.incoming)} />
              <MiniMetric label="Committed to orders" value={String(item.inventory.reserved)} />
              <MiniMetric label="Available to sell" value={String(item.inventory.available)} />
              <MiniMetric label="Needs review" value={String(item.inventory.damaged + item.inventory.quarantined + item.inventory.lost)} />
              <MiniMetric label="Inventory value" value={money(item.inventory.value)} />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-700/35 bg-black/35 p-4 text-sm text-muted-foreground">
              Next inventory move: <span className="text-foreground">{item.inventory.incoming ? "Receive incoming units when they arrive." : item.inventory.available <= item.purchasing.reorderPoint ? `Order ${item.purchasing.recommendedReorderQuantity} more from ${item.supplierName}.` : "Keep selling and watch reorder timing."}</span>
              <span className="block pt-2">Supplier: <span className="text-foreground">{item.supplierName}</span> · Lead time {item.purchasing.leadTime} · Reorder point {item.purchasing.reorderPoint}</span>
            </div>
          </Panel>
          <Panel title="Related products">
            <div className="grid gap-3">
              {item.intelligence.relationships.length ? item.intelligence.relationships.map((relationship) => (
                <Link key={`${relationship.type}-${relationship.href}`} href={relationship.href} className="rounded-2xl border border-slate-700/35 bg-black/35 p-3 transition hover:border-slate-400/45">
                  <p className="text-sm font-medium">{relationship.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{relationship.detail}</p>
                </Link>
              )) : <p className="text-sm text-muted-foreground">No strong product relationships are proven yet. Shared supplier, category, marketplace, and pricing patterns will appear here as the catalog grows.</p>}
            </div>
          </Panel>
        </div>
      </section>

      <details className="faust-surface p-5">
        <summary className="cursor-pointer text-xl font-semibold">Product timeline</summary>
        <div className="mt-4">
          <ActivityTimeline items={item.timeline.map((event) => ({ id: event.id, title: event.title, detail: event.detail, at: new Date(event.at).toLocaleString() }))} />
        </div>
      </details>

      <Panel title="Advanced">
        <details className="rounded-2xl border border-slate-700/35 bg-black/35 p-4 text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Technical information and diagnostics</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Row label="Product ID" value={item.product.id} />
            <Row label="Variant ID" value={item.variant.id} />
            <Row label="Source URL" value={item.product.sourceUrl ? <Link className="text-[#edf3ff]" href={item.product.sourceUrl}>Open source</Link> : "Not captured"} />
            <Row label="Status" value={readinessLabel(item.readiness.status)} />
          </div>
        </details>
      </Panel>
      {editing ? <ProductEditDrawer item={item} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function ProductDnaCapsule({ item }: { item: ProductExperience }) {
  const dnaTags = item.intelligence.dna.length ? item.intelligence.dna : [{ tag: "Needs attention" as const, reason: "Faust needs more product history before stronger DNA traits become reliable." }];
  const liveChannels = item.marketplaces.filter((marketplace) => marketplace.status === "live").length;
  const twinImage = item.image || item.product.images?.[0] || "";
  const twinPose = productTwinPose(item.product.category);
  const knowledgeSignals = [
    item.product.description ? 1 : 0,
    item.product.images?.length ? 1 : 0,
    item.analytics.unitsSold ? 1 : 0,
    liveChannels ? 1 : 0,
    item.timeline.length > 3 ? 1 : 0,
    item.supplierName !== "Supplier not linked" ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const growth = knowledgeSignals <= 1 ? "New" : knowledgeSignals <= 3 ? "Developing" : knowledgeSignals <= 5 ? "Active" : "Established";
  const strongestTrait = dnaTags[0];
  const marketPosition = item.finance.margin >= 55 ? "Premium margin profile" : item.finance.margin >= 35 ? "Competitive resale profile" : item.finance.revenue ? "Margin needs review" : "Market position still forming";
  const opportunity = item.inventory.available <= 0 ? "Receive inventory" : item.readiness.score < 80 ? item.readiness.nextAction : liveChannels < 3 ? "Cross-list to more channels" : "Watch pricing and velocity";
  const memory = item.analytics.unitsSold
    ? `${item.analytics.unitsSold} unit(s) sold. ${item.analytics.bestMarketplace} is the strongest observed channel.`
    : item.timeline.length > 2
      ? "Faust has import, edit, and inventory history, but sales memory is still forming."
      : "This product is newly captured. Faust will learn more as it is listed, purchased, and sold.";
  const story = `${item.product.category || "This product"} is currently understood as ${strongestTrait.tag.toLowerCase()} with ${item.finance.margin.toFixed(1)}% projected margin. ${strongestTrait.reason}`;
  const lifecycle = ["Imported", "Analyzed", liveChannels ? "Published" : "Drafted", item.inventory.incoming ? "Restocking" : item.inventory.available ? "Stocked" : "Waiting", item.analytics.unitsSold ? "First sale" : "No sale yet"];

  return (
    <section className="relative overflow-hidden rounded-[2.3rem] border border-slate-700/45 bg-[linear-gradient(135deg,rgba(7,10,15,.96),rgba(15,19,28,.9)_48%,rgba(7,10,15,.96))] p-5 shadow-2xl shadow-black/35">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(102,112,141,.25),transparent_28rem),radial-gradient(circle_at_82%_60%,rgba(200,210,230,.08),transparent_18rem)]" />
      <div className="relative grid gap-6 xl:grid-cols-[1fr_380px_1fr]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8d2e6]">Product DNA</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Living product archive</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Faust&apos;s containment chamber for what the system has learned about this SKU—not another place to repeat product fields.
            </p>
          </div>
          <DnaInsightTile icon={<Sparkles size={16} />} title="Product story" value={story} />
          <DnaInsightTile icon={<Atom size={16} />} title="Product fingerprint" value={dnaTags.slice(0, 5).map((dna) => dna.tag).join(" · ")} />
        </div>

        <DigitalTwinChamber key={`${item.product.id}:${item.coverImage?.id || item.product.coverImageId || twinImage || "no-cover"}:${item.coverImage?.revision || "no-revision"}`} item={item} sourceImage={twinImage} twinPose={twinPose} growth={growth} />

        <div className="space-y-4">
          <DnaInsightTile icon={<GitBranch size={16} />} title="Market position" value={`${marketPosition}. ${item.analytics.bestMarketplace} is ${item.analytics.unitsSold ? "supported by order history" : "the current best candidate"} for early learning.`} />
          <DnaInsightTile icon={<ArrowRight size={16} />} title="Highest-value opportunity" value={`${opportunity}. Expected lift: ${item.readiness.score < 80 ? "higher readiness and cleaner publishing" : "stronger distribution signal"}.`} />
          <DnaInsightTile icon={<Sparkles size={16} />} title="Product memory" value={memory} />
        </div>
      </div>
      <div className="relative mt-5 grid gap-3 border-t border-slate-700/35 pt-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-wrap gap-2">
          {dnaTags.map((dna) => <span key={dna.tag} className="rounded-full border border-slate-600/45 bg-slate-800/20 px-3 py-1.5 text-xs font-medium text-[#f6f8ff]" title={dna.reason}>{dna.tag}</span>)}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {lifecycle.map((event, index) => (
            <span key={`${event}-${index}`} className="inline-flex items-center gap-2">
              <span className="rounded-full border border-slate-600/40 bg-black/30 px-3 py-1.5 text-[#edf3ff]">{event}</span>
              {index < lifecycle.length - 1 ? <span className="text-slate-600">→</span> : null}
            </span>
          ))}
        </div>
      </div>
      <style jsx>{`
        .dna-capsule::before {
          content: "";
          position: absolute;
          inset: 14px 28px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent);
          transform: translateX(-24px);
          animation: capsule-sheen 7s ease-in-out infinite;
        }
        .digital-twin {
          animation: twin-float 7.5s ease-in-out infinite;
          isolation: isolate;
          transition: transform .5s ease, filter .5s ease;
        }
        .dna-twin-stage:hover .digital-twin,
        .digital-twin:focus-within {
          transform: translate(-50%, -51%) scale(1.025);
          filter: brightness(1.06) drop-shadow(0 0 24px rgba(200,210,230,.34));
        }
        .twin-artifact,
        .twin-placeholder {
          position: absolute;
          inset: 0;
          height: 100%;
          width: 100%;
          object-fit: contain;
          object-position: center;
          pointer-events: none;
          filter: saturate(.72) contrast(1.22) brightness(1.08) drop-shadow(0 0 18px rgba(200,210,230,.26));
          mix-blend-mode: multiply;
          opacity: .94;
          mask-image: radial-gradient(ellipse at center, black 64%, rgba(0,0,0,.92) 74%, transparent 91%);
          animation: twin-stabilize .82s ease-out both;
        }
        .twin-shirt .twin-artifact { object-position: 50% 48%; transform: scale(.88); }
        .twin-jewelry .twin-artifact { object-position: 50% 42%; transform: scale(.72); }
        .twin-bag .twin-artifact { transform: scale(.92); }
        .twin-object .twin-artifact { transform: scale(.82); }
        .twin-fallback { mix-blend-mode: normal; opacity: .72; }
        .twin-placeholder {
          display: grid;
          place-items: center;
          color: rgba(237,243,255,.82);
          border-radius: 999px;
          background: radial-gradient(circle, rgba(237,243,255,.16), transparent 68%);
        }
        .twin-scan {
          position: absolute;
          inset: -8px 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, transparent, rgba(237,243,255,.58), transparent);
          opacity: 0;
          transform: translateY(-70%);
          animation: twin-scan .88s ease-out .08s both;
        }
        .twin-orbit {
          position: absolute;
          left: 50%;
          top: 50%;
          height: 128px;
          width: 82px;
          border: 1px solid rgba(200,210,230,.18);
          border-radius: 999px;
          transform: translate(-50%, -50%) rotateX(64deg) rotateZ(18deg);
          box-shadow: 0 0 18px rgba(102,112,141,.16);
        }
        .twin-orbit-b {
          height: 148px;
          width: 98px;
          opacity: .6;
          transform: translate(-50%, -50%) rotateX(68deg) rotateZ(-24deg);
        }
        .twin-particles span {
          position: absolute;
          left: var(--particle-left);
          top: var(--particle-top);
          height: 2px;
          width: 2px;
          border-radius: 999px;
          background: rgba(237,243,255,.72);
          box-shadow: 0 0 10px rgba(200,210,230,.8);
          animation: particle-drift 8s ease-in-out infinite;
          animation-delay: calc(var(--particle-index) * -.42s);
        }
        @keyframes capsule-sheen {
          0%, 64%, 100% { opacity: .28; transform: translateX(-24px); }
          76% { opacity: .68; transform: translateX(28px); }
        }
        @keyframes twin-float {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -52%) translateY(-6px); }
        }
        @keyframes twin-stabilize {
          0% { opacity: 0; filter: saturate(.2) contrast(1.4) brightness(1.55) blur(4px); clip-path: inset(48% 0 48% 0); }
          58% { opacity: .72; filter: saturate(.55) contrast(1.28) brightness(1.22) blur(1px); clip-path: inset(8% 0 8% 0); }
          100% { opacity: .94; filter: saturate(.72) contrast(1.22) brightness(1.08) drop-shadow(0 0 18px rgba(200,210,230,.26)); clip-path: inset(0); }
        }
        @keyframes twin-scan {
          0%, 72%, 100% { opacity: 0; transform: translateY(-72%); }
          78% { opacity: .72; }
          88% { opacity: .2; transform: translateY(72%); }
        }
        @keyframes particle-drift {
          0%, 100% { opacity: .25; transform: translate3d(0, 0, 0); }
          50% { opacity: .78; transform: translate3d(6px, -8px, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dna-capsule::before,
          .digital-twin,
          .twin-artifact,
          .twin-scan,
          .twin-particles span { animation: none; }
        }
      `}</style>
    </section>
  );
}

const digitalTwinProcessorVersion = "faust-canvas-segmentation-v1";

function DigitalTwinChamber({ item, sourceImage, twinPose, growth }: { item: ProductExperience; sourceImage: string; twinPose: string; growth: string }) {
  const expectedSourceId = item.product.coverImageId || "";
  const expectedRevision = item.coverImage?.revision || null;
  const sourceMatches = Boolean(sourceImage && item.digitalTwin?.processorVersion === digitalTwinProcessorVersion && (expectedSourceId ? item.digitalTwin.sourceImageId === expectedSourceId && (item.digitalTwin.sourceImageRevision || null) === expectedRevision : item.digitalTwin.sourceImageUrl === sourceImage));
  const initialStatus = sourceMatches ? item.digitalTwin?.processingStatus || "not_started" : sourceImage ? "not_started" : "failed";
  const [status, setStatus] = useState(initialStatus);
  const [assetUrl, setAssetUrl] = useState(sourceMatches && item.digitalTwin?.processingStatus === "ready" ? item.digitalTwin.transparentImageUrl || "" : "");
  const [message, setMessage] = useState(sourceImage ? (sourceMatches ? "Product profile can be built from this cover." : "Updating Product Image") : "Add a cover photo to build the Product Profile.");
  const [busy, setBusy] = useState(false);

  async function generateTwin() {
    if (!sourceImage || busy) return;
    setBusy(true);
    setStatus("processing");
    setMessage("Updating Product Image");
    try {
      const result = await generateTransparentProductCutout(sourceImage, item.product.category);
      const file = new File([result.blob], `${item.product.id}-digital-twin.png`, { type: "image/png" });
      const form = new FormData();
      form.append("file", file);
      const upload = await fetch("/api/import-image", { method: "POST", body: form }).then((response) => response.json());
      if (!upload.ok || !upload.url) throw new Error(upload.message || "Product image analysis could not be saved.");
      const processingStatus = result.confidence >= 0.42 ? "ready" : "needs_review";
      const save = await fetch("/api/products/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-digital-twin",
          productId: item.product.id,
          sourceImageId: item.coverImage?.id || item.product.coverImageId,
          sourceImageUrl: sourceImage,
          sourceImageRevision: item.coverImage?.revision || null,
          transparentImageUrl: upload.url,
          storageKey: upload.storageKey,
          processingStatus,
          segmentationConfidence: result.confidence,
          bounds: result.bounds,
          sourceDimensions: result.sourceDimensions,
          transparentDimensions: result.transparentDimensions,
          processorVersion: digitalTwinProcessorVersion,
          failureCode: processingStatus === "needs_review" ? "low_confidence" : null,
        }),
      }).then((response) => response.json());
      if (!save.ok) throw new Error(save.message || "Product profile could not be saved.");
      setAssetUrl(upload.url);
      setStatus(processingStatus);
      setMessage(processingStatus === "ready" ? "Product Profile Active" : "Review Product Cutout");
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Product Image Analysis Needs Attention");
      await fetch("/api/products/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-digital-twin",
          productId: item.product.id,
          sourceImageId: item.coverImage?.id || item.product.coverImageId,
          sourceImageUrl: sourceImage,
          sourceImageRevision: item.coverImage?.revision || null,
          processingStatus: "failed",
          segmentationConfidence: null,
          processorVersion: digitalTwinProcessorVersion,
          failureCode: error instanceof Error ? error.message.slice(0, 100) : "processing_failed",
        }),
      }).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!sourceImage || assetUrl || busy || status === "failed") return;
    const run = window.setTimeout(() => void generateTwin(), 0);
    return () => window.clearTimeout(run);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generation is keyed by the source image and stored twin state.
  }, [sourceImage]);

  const ready = status === "ready" && assetUrl;

  return (
    <div className="dna-twin-stage relative mx-auto grid min-h-[300px] w-full max-w-[380px] place-items-center">
      <div className="absolute inset-x-8 top-8 h-8 rounded-full border border-slate-500/35 bg-slate-300/10 blur-[1px]" />
      <div className="dna-capsule relative h-[286px] w-[176px] rounded-[5rem] border border-slate-400/35 bg-[linear-gradient(90deg,rgba(200,210,230,.08),rgba(200,210,230,.22),rgba(40,48,65,.2))] shadow-[0_0_50px_rgba(102,112,141,.22),inset_0_0_30px_rgba(200,210,230,.12)]">
        <div className="absolute inset-3 rounded-[5rem] border border-slate-200/10 bg-black/30 backdrop-blur-sm" />
        <div className="absolute inset-6 rounded-[5rem] bg-[radial-gradient(circle_at_50%_45%,rgba(237,243,255,.18),rgba(102,112,141,.1)_42%,transparent_72%)]" />
        <div className={`digital-twin ${twinPose} absolute left-1/2 top-1/2 h-[188px] w-[132px] -translate-x-1/2 -translate-y-1/2`} aria-label={`${item.product.title} product profile`}>
          {ready ? (
            <ProductImage src={assetUrl} alt={`${item.product.title} product cutout`} className="twin-artifact" fallbackClassName="twin-placeholder" />
          ) : (
            <div className="twin-placeholder" aria-hidden="true">
              <Atom size={42} />
              <span className="sr-only">{message}</span>
            </div>
          )}
          <span className="twin-scan" aria-hidden="true" />
          <span className="twin-orbit twin-orbit-a" aria-hidden="true" />
          <span className="twin-orbit twin-orbit-b" aria-hidden="true" />
        </div>
        <div className="twin-particles absolute inset-7" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => (
            <span
              key={index}
              style={{
                "--particle-index": index,
                "--particle-left": `${20 + (index % 5) * 15}%`,
                "--particle-top": `${16 + (index % 4) * 17}%`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="absolute inset-x-[-18px] bottom-7 h-5 rounded-full border border-slate-400/25 bg-slate-950/70" />
      </div>
      <div className="absolute bottom-2 rounded-full border border-slate-600/45 bg-black/55 px-4 py-2 text-center shadow-lg shadow-black/40">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{ready ? "Product Image Active" : status === "processing" ? "Updating Product Image" : "Product Profile"}</p>
        <p className="font-heading text-xl font-semibold text-[#f6f8ff]">{ready ? growth : status === "needs_review" ? "Review" : status === "failed" ? "Needs Attention" : "Updating"}</p>
        {!ready ? <button type="button" disabled={!sourceImage || busy} onClick={generateTwin} className="mt-2 text-[11px] font-semibold text-[#c8d2e6] transition hover:text-[#f6f8ff] disabled:opacity-50">{status === "failed" ? "Retry Image Processing" : sourceMatches ? "Analyze Current Cover" : "Refresh Product Image"}</button> : null}
      </div>
    </div>
  );
}

function DnaInsightTile({ icon, title, value }: { icon: ReactNode; title: string; value: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-700/35 bg-black/30 p-4 shadow-lg shadow-black/15">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#edf3ff]">{icon}{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{value}</p>
    </div>
  );
}

function productTwinPose(category: string) {
  const normalized = category.toLowerCase();
  if (/(necklace|jewelry|bracelet|ring|chain|pendant)/.test(normalized)) return "twin-jewelry";
  if (/(bag|purse|tote|backpack)/.test(normalized)) return "twin-bag";
  if (/(shirt|tee|hoodie|jacket|sweater|top|dress|pants|shorts)/.test(normalized)) return "twin-shirt";
  return "twin-object";
}

function proxiedImageUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return `/api/import-image?url=${encodeURIComponent(url)}`;
  return url;
}

function loadCanvasImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("source_image_unavailable"));
    image.src = proxiedImageUrl(url);
  });
}

async function generateTransparentProductCutout(sourceUrl: string, category: string) {
  const image = await loadCanvasImage(sourceUrl);
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("canvas_unavailable");
  sourceContext.drawImage(image, 0, 0, width, height);
  const imageData = sourceContext.getImageData(0, 0, width, height);
  const data = imageData.data;
  const background = new Uint8Array(width * height);
  const queue: number[] = [];
  const borderSamples: [number, number, number][] = [];
  const sampleBorder = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    borderSamples.push([data[index], data[index + 1], data[index + 2]]);
  };
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 80));
  for (let x = 0; x < width; x += stride) {
    sampleBorder(x, 0);
    sampleBorder(x, height - 1);
  }
  for (let y = 0; y < height; y += stride) {
    sampleBorder(0, y);
    sampleBorder(width - 1, y);
  }
  const avg = borderSamples.reduce((sum, color) => [sum[0] + color[0], sum[1] + color[1], sum[2] + color[2]], [0, 0, 0]).map((value) => value / Math.max(1, borderSamples.length));
  const colorDistance = (offset: number, color = avg) => Math.hypot(data[offset] - color[0], data[offset + 1] - color[1], data[offset + 2] - color[2]);
  const edgeEnergy = (x: number, y: number) => {
    const left = (y * width + Math.max(0, x - 1)) * 4;
    const right = (y * width + Math.min(width - 1, x + 1)) * 4;
    const top = (Math.max(0, y - 1) * width + x) * 4;
    const bottom = (Math.min(height - 1, y + 1) * width + x) * 4;
    return Math.abs(data[left] - data[right]) + Math.abs(data[left + 1] - data[right + 1]) + Math.abs(data[left + 2] - data[right + 2]) + Math.abs(data[top] - data[bottom]) + Math.abs(data[top + 1] - data[bottom + 1]) + Math.abs(data[top + 2] - data[bottom + 2]);
  };
  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (background[pixel]) return;
    background[pixel] = 1;
    queue.push(pixel);
  };
  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }
  const threshold = Math.max(34, Math.min(78, 42 + Math.hypot(...avg.map((channel) => channel - 128)) / 8));
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixel = queue[cursor];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const neighbors = [pixel - 1, pixel + 1, pixel - width, pixel + width];
    for (const neighbor of neighbors) {
      if (neighbor < 0 || neighbor >= width * height || background[neighbor]) continue;
      const nx = neighbor % width;
      const ny = Math.floor(neighbor / width);
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      const offset = neighbor * 4;
      const smoothBackground = colorDistance(offset) <= threshold && edgeEnergy(nx, ny) < 138;
      const lowAlpha = data[offset + 3] < 32;
      if (smoothBackground || lowAlpha) enqueue(nx, ny);
    }
  }
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let foregroundPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      if (background[pixel]) {
        data[offset + 3] = 0;
        continue;
      }
      const alpha = data[offset + 3];
      if (alpha > 0) {
        const nearbyBackground = x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2 || background[pixel - 1] || background[pixel + 1] || background[pixel - width] || background[pixel + width];
        if (nearbyBackground) data[offset + 3] = Math.max(0, alpha - 24);
        foregroundPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) throw new Error("foreground_not_detected");
  sourceContext.putImageData(imageData, 0, 0);
  const bounds = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  const outputSize = 1024;
  const output = document.createElement("canvas");
  output.width = outputSize;
  output.height = outputSize;
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("canvas_unavailable");
  const normalized = category.toLowerCase();
  const targetFill = /(necklace|jewelry|bracelet|ring|chain|pendant)/.test(normalized) ? 0.62 : /(bag|purse|tote|backpack)/.test(normalized) ? 0.7 : 0.74;
  const drawScale = Math.min((outputSize * targetFill) / bounds.width, (outputSize * targetFill) / bounds.height);
  const drawWidth = bounds.width * drawScale;
  const drawHeight = bounds.height * drawScale;
  const dx = (outputSize - drawWidth) / 2;
  const dy = (outputSize - drawHeight) / 2;
  outputContext.drawImage(sourceCanvas, bounds.x, bounds.y, bounds.width, bounds.height, dx, dy, drawWidth, drawHeight);
  const edgeClear = bounds.x > 2 && bounds.y > 2 && maxX < width - 3 && maxY < height - 3 ? 0.18 : -0.12;
  const foregroundRatio = foregroundPixels / (width * height);
  const confidence = Math.max(0.2, Math.min(0.92, 0.46 + edgeClear + (foregroundRatio > 0.08 && foregroundRatio < 0.78 ? 0.2 : -0.08)));
  const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((next) => next ? resolve(next) : reject(new Error("transparent_export_failed")), "image/png"));
  return {
    blob,
    confidence,
    bounds,
    sourceDimensions: { width: image.naturalWidth, height: image.naturalHeight },
    transparentDimensions: { width: outputSize, height: outputSize },
  };
}

function ProductEditDrawer({ item, onClose }: { item: ProductExperience; onClose: () => void }) {
  const [draft, setDraft] = useState({
    title: item.product.title,
    sku: item.variant.sku,
    brand: item.product.brand || "",
    category: item.product.category,
    condition: item.variant.condition,
    description: item.product.description || "",
    notes: item.product.notes || "",
    sourceUrl: item.product.sourceUrl || "",
    landedUnitCost: item.variant.landedUnitCost,
    defaultSalePrice: item.variant.defaultSalePrice,
    images: (item.product.images?.length ? item.product.images : item.image ? [item.image] : []).slice(0, 12),
  });
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/products/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", variantId: item.variant.id, ...draft }) });
        const data = await response.json();
        if (!response.ok || data.ok === false) throw new Error(data.message || "Product could not be saved.");
        toast.success("Product saved");
        onClose();
        router.refresh();
      } catch (error) {
        toast.error("Could not save product", { description: error instanceof Error ? error.message : "Try again." });
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-slate-700/45 bg-[#080b10] shadow-2xl shadow-black/70">
        <div className="flex items-start justify-between gap-4 border-b border-slate-700/45 p-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c8d2e6]">Product editor</p><h2 className="mt-2 text-2xl font-semibold">Edit Product</h2><p className="mt-1 text-sm text-muted-foreground">Update the permanent catalog record without leaving the workspace.</p></div>
          <button type="button" aria-label="Close editor" onClick={onClose} className="rounded-full border border-slate-700/60 p-2 text-[#f6f8ff] transition hover:border-slate-400/60"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium sm:col-span-2">Product name<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="faust-field faust-focus mt-2 w-full p-3" /></label>
            <label className="text-sm font-medium">SKU<input value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} className="faust-field faust-focus mt-2 w-full p-3" /></label>
            <label className="text-sm font-medium">Brand<input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} className="faust-field faust-focus mt-2 w-full p-3" /></label>
            <label className="text-sm font-medium">Category<input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="faust-field faust-focus mt-2 w-full p-3" /></label>
            <label className="text-sm font-medium">Condition<input value={draft.condition} onChange={(event) => setDraft({ ...draft, condition: event.target.value })} className="faust-field faust-focus mt-2 w-full p-3" /></label>
            <label className="text-sm font-medium">Cost<input type="number" min="0" step="0.01" value={draft.landedUnitCost} onChange={(event) => setDraft({ ...draft, landedUnitCost: Number(event.target.value) || 0 })} className="faust-field faust-focus mt-2 w-full p-3" /></label>
            <label className="text-sm font-medium">Target sale price<input type="number" min="0" step="0.01" value={draft.defaultSalePrice} onChange={(event) => setDraft({ ...draft, defaultSalePrice: Number(event.target.value) || 0 })} className="faust-field faust-focus mt-2 w-full p-3" /></label>
            <label className="text-sm font-medium sm:col-span-2">Source URL<input value={draft.sourceUrl} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} className="faust-field faust-focus mt-2 w-full p-3" /></label>
            <label className="text-sm font-medium sm:col-span-2">Description<textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="faust-field faust-focus mt-2 w-full resize-none p-3" /></label>
            <label className="text-sm font-medium sm:col-span-2">Notes<textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="faust-field faust-focus mt-2 w-full resize-none p-3" /></label>
          </section>
          <section>
            <ProductImageManager
              title="Photos"
              description="These are the permanent product photos. First image is the catalog cover."
              productName={draft.title}
              images={draft.images}
              onChange={(images) => setDraft({ ...draft, images })}
              storageKey={`product-editor-${item.product.id}`}
              compact
            />
          </section>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-700/45 p-5">
          <button type="button" className="faust-secondary-action" onClick={onClose}>Cancel</button>
          <button type="button" disabled={busy} className="faust-action inline-flex items-center gap-2" onClick={save}><Save size={16} />{busy ? "Saving..." : "Save Product"}</button>
        </div>
      </aside>
    </div>
  );
}

function PersistentProductImages({ item }: { item: ProductExperience }) {
  const [images, setImages] = useState((item.product.images?.length ? item.product.images : item.image ? [item.image] : []).slice(0, 12));
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  function saveImages(nextImages: string[]) {
    setImages(nextImages);
    startTransition(async () => {
      try {
        const response = await fetch("/api/products/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", variantId: item.variant.id, images: nextImages }),
        });
        const data = await response.json();
        if (!response.ok || data.ok === false) throw new Error(data.message || "Product photos could not be saved.");
        router.refresh();
      } catch (error) {
        toast.error("Could not save photos", { description: error instanceof Error ? error.message : "Try again." });
      }
    });
  }

  return (
    <div className={busy ? "opacity-80 transition" : ""}>
      <ProductImageManager
        title="Product photos"
        description="This is the permanent product image library. First image is the cover shown in Products and listing drafts."
        productName={item.product.title}
        images={images}
        onChange={saveImages}
        storageKey={`product-${item.product.id}`}
        compact
      />
      {busy ? <p className="mt-3 text-xs text-muted-foreground">Saving photo changes…</p> : null}
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-slate-700/35 bg-black/35 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{value}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-700/35 bg-black/35 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-heading text-xl font-semibold tabular-nums">{value}</p></div>;
}

function Panel({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return <section id={id} className="faust-surface h-fit p-5"><h2 className="text-xl font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex justify-between gap-4 border-b border-slate-700/35 py-3 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><span className="text-right">{value}</span></div>;
}

function HealthSignal({ signal }: { signal: ProductExperience["intelligence"]["health"][number] }) {
  const tone = signal.status === "strong" ? "text-[#f6f8ff]" : signal.status === "healthy" ? "text-emerald-200" : signal.status === "watch" ? "text-amber-200" : signal.status === "risk" ? "text-[#edf3ff]" : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-slate-700/35 bg-black/35 p-4">
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
  const tone = marketplace.status === "live" ? "text-[#f6f8ff]" : marketplace.status === "rejected" || marketplace.status === "out_of_stock" ? "text-amber-200" : "text-muted-foreground";
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/35 bg-black/35 p-3"><MarketplaceBadge marketplace={marketplace.marketplace} /><span className={`text-sm capitalize ${tone}`}>{marketplace.status.replaceAll("_", " ")}</span></div>;
}
