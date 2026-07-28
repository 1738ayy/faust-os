"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Atom, CheckCircle2, CircleAlert, Edit3, Eye, GitBranch, Save, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { ActivityTimeline, MarketplaceBadge, PrimaryButton, StatusBadge } from "@/components/faust/design-system";
import { ProductImage } from "@/components/products/product-image";
import { ProductImageManager } from "@/components/products/product-image-manager";
import { ReadinessRing } from "@/components/products/readiness-ring";
import type { ProductExperience } from "@/lib/product-experience";
import { money } from "@/lib/business-calculations";
import { buildProductDnaProfile, type ProductDnaProfile } from "@/lib/product-dna";
import { readinessLabel } from "@/lib/product-readiness";
import type { ProductKnowledgeField } from "@/domain/business";

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

      <ProductKnowledgePanel item={item} />
      <VisualIntelligencePanel item={item} />

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

function VisualIntelligencePanel({ item }: { item: ProductExperience }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const visual = item.visualIntelligence;
  const recommendedImage = visual.recommendation ? (item.product.images || []).find((_, index) => index === 0 && visual.recommendation?.recommendedImageId === item.coverImage?.id) || item.image : item.image;
  const choose = (payload: Record<string, unknown>) => {
    startTransition(async () => {
      const response = await fetch("/api/products/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review-image-intelligence", productId: item.product.id, ...payload }) });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message || "Could not save visual review.");
        return;
      }
      toast.success("Visual intelligence review saved.");
      router.refresh();
    });
  };
  return (
    <Panel title="Visual Intelligence">
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-slate-700/35 bg-black/35 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#edf3ff]"><Eye size={16} />Image-backed Product evidence</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Faust uses images as supporting evidence only. Image guesses can corroborate, lower confidence, or request review, but they never replace user decisions or reliable supplier facts.
          </p>
          {recommendedImage ? <ProductImage src={recommendedImage} alt="Recommended cover preview" className="mt-4 aspect-[4/3] w-full rounded-3xl border border-slate-700/35 object-cover" fallbackClassName="mt-4 aspect-[4/3] w-full rounded-3xl border border-slate-700/35" /> : null}
          {visual.recommendation ? (
            <div className="mt-4 rounded-2xl border border-slate-700/35 bg-slate-950/45 p-3">
              <p className="text-sm font-semibold text-[#f6f8ff]">Recommended cover · {Math.round(visual.recommendation.confidence * 100)}%</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{visual.recommendation.explanation}</p>
              <button type="button" disabled={isPending || visual.recommendation.status === "approved"} onClick={() => choose({ imageAction: "approve_cover" })} className="mt-3 rounded-full border border-slate-600/60 bg-[#66708d] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#77829f] disabled:opacity-50">Approve cover</button>
            </div>
          ) : <p className="mt-4 rounded-2xl border border-slate-700/35 bg-slate-950/45 p-3 text-sm text-muted-foreground">Add Product images to get cover recommendations.</p>}
        </div>
        <div className="grid gap-3">
          {visual.conflict ? (
            <div className="rounded-3xl border border-amber-400/25 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-100">Review required</p>
              <p className="mt-2 text-sm leading-6 text-amber-50/80">{visual.conflict.message}</p>
            </div>
          ) : null}
          <div className="rounded-3xl border border-slate-700/35 bg-black/35 p-4">
            <p className="text-sm font-semibold text-[#edf3ff]">Category candidates</p>
            <div className="mt-3 grid gap-2">
              {visual.categoryCandidates.slice(0, 3).map((candidate) => (
                <article key={candidate.id} aria-label={`Category candidate ${candidate.label}`} className="rounded-2xl border border-slate-700/35 bg-slate-950/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{candidate.label}</p>
                    <span className="text-xs text-muted-foreground">{candidate.confidence}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{candidate.supportingEvidence[0]}</p>
                  {candidate.conflictingEvidence.length ? <p className="mt-1 text-xs text-amber-100">{candidate.conflictingEvidence[0]}</p> : null}
                  <button type="button" disabled={isPending} onClick={() => choose({ imageAction: "approve_category_candidate", fieldKey: "universal_category", value: candidate.label })} className="mt-2 rounded-full border border-slate-700/60 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-[#edf3ff] transition hover:border-slate-400/60 disabled:opacity-50">Approve category</button>
                </article>
              ))}
              {!visual.categoryCandidates.length ? <p className="text-sm text-muted-foreground">No image-supported category candidate is strong enough yet.</p> : null}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-700/35 bg-black/35 p-4">
            <p className="text-sm font-semibold text-[#edf3ff]">Image review</p>
            <div className="mt-3 grid gap-2">
              {visual.qualities.slice(0, 5).map((quality, index) => (
                <article key={quality.id} aria-label={`Image review ${index + 1} ${quality.role.replaceAll("_", " ")}`} className="rounded-2xl border border-slate-700/35 bg-slate-950/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Image {index + 1} · {quality.role.replaceAll("_", " ")}</p>
                    <span className="text-xs text-muted-foreground">{quality.marketplaceSuitability}% suitable</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{quality.explanation}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={isPending} onClick={() => choose({ imageAction: "mark_size_chart", imageId: quality.imageId })} className="rounded-full border border-slate-700/60 px-3 py-1 text-xs">Size chart</button>
                    <button type="button" disabled={isPending} onClick={() => choose({ imageAction: "mark_detail_only", imageId: quality.imageId })} className="rounded-full border border-slate-700/60 px-3 py-1 text-xs">Detail only</button>
                    <button type="button" disabled={isPending} onClick={() => choose({ imageAction: "exclude_from_publishing", imageId: quality.imageId })} className="rounded-full border border-slate-700/60 px-3 py-1 text-xs">Exclude</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ProductKnowledgePanel({ item }: { item: ProductExperience }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const priority = ["universal_category", "product_type", "material", "fabric_composition", "supplier_shop", "price", "domestic_shipping", "minimum_order_quantity", "variant_groups", "variant_options", "suggested_title", "suggested_description", "image_set"];
  const fields = [...item.productKnowledge.fields]
    .sort((a, b) => {
      const aIndex = priority.indexOf(a.fieldKey);
      const bIndex = priority.indexOf(b.fieldKey);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    })
    .slice(0, 8);
  const { overview, reviewPlan } = item.productKnowledge;

  const decide = (field: ProductKnowledgeField, decision: "confirmed" | "corrected" | "rejected", value?: ProductKnowledgeField["value"]) => {
    startTransition(async () => {
      const response = await fetch("/api/products/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review-knowledge", productId: item.product.id, fieldKey: field.fieldKey, decision, value }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message || "Could not save Product Knowledge.");
        return;
      }
      toast.success(decision === "rejected" ? "Suggestion rejected." : "Product Knowledge saved.");
      router.refresh();
    });
  };

  const approveSafeFacts = () => {
    startTransition(async () => {
      const safeKeys = reviewPlan.safeBulkApproval.map((field) => field.fieldKey);
      const response = await fetch("/api/products/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve-knowledge-facts", productId: item.product.id, fieldKeys: safeKeys }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message || "Could not approve Product Knowledge.");
        return;
      }
      toast.success(`${safeKeys.length} high-confidence fact${safeKeys.length === 1 ? "" : "s"} approved.`);
      router.refresh();
    });
  };

  return (
    <Panel title="Product Knowledge">
      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-3xl border border-slate-700/35 bg-black/35 p-4">
          <p className="text-sm font-semibold text-[#edf3ff]">Faust understands {overview.understoodPercent}% of this Product.</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {overview.mustReview} field(s) need review. {overview.missing} field(s) are missing. {overview.conflicts} conflict(s) were detected. {overview.confirmedEvidence} field(s) were confirmed from supplier evidence.
          </p>
          <div className="mt-4 rounded-2xl border border-slate-700/35 bg-slate-950/45 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c8d2e6]">Recommended primary action</p>
            <p className="mt-1 text-sm font-semibold text-[#f6f8ff]">{overview.recommendedPrimaryAction}</p>
          </div>
          {reviewPlan.safeBulkApproval.length ? (
            <button type="button" disabled={isPending} onClick={approveSafeFacts} className="mt-3 w-full rounded-full border border-slate-600/60 bg-[#66708d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#77829f] disabled:opacity-50">
              Approve {reviewPlan.safeBulkApproval.length} safe supplier fact{reviewPlan.safeBulkApproval.length === 1 ? "" : "s"}
            </button>
          ) : null}
          <div className="mt-4 grid gap-2">
            {item.productKnowledge.completeness.map((category) => (
              <div key={category.label} className="rounded-2xl border border-slate-700/35 bg-slate-950/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{category.label}</span>
                  <span className="font-heading text-lg font-semibold tabular-nums text-[#f6f8ff]">{category.score}%</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{category.recommendedAction}</p>
              </div>
            ))}
          </div>
          <details className="mt-4 rounded-2xl border border-slate-700/35 bg-black/25 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-[#edf3ff]">Review groups</summary>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
              <p>Must review: {reviewPlan.mustReview.length}</p>
              <p>Recommended review: {reviewPlan.recommendedReview.length}</p>
              <p>Already understood: {reviewPlan.alreadyUnderstood.length}</p>
              <p>High-confidence safe approvals: {reviewPlan.safeBulkApproval.length}</p>
            </div>
          </details>
        </div>
        <div className="grid gap-3">
          {fields.length ? fields.map((field) => <KnowledgeFieldRow key={field.id} field={field} disabled={isPending} onDecide={decide} />) : <p className="rounded-2xl border border-slate-700/35 bg-black/35 p-4 text-sm text-muted-foreground">No Product Knowledge has been captured yet. Import from the Faust extension to create evidence-backed suggestions.</p>}
        </div>
      </div>
    </Panel>
  );
}

function KnowledgeFieldRow({ field, disabled, onDecide }: { field: ProductKnowledgeField; disabled: boolean; onDecide: (field: ProductKnowledgeField, decision: "confirmed" | "corrected" | "rejected", value?: ProductKnowledgeField["value"]) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(valueLabel(field.value));
  const statusLabel = field.status === "corrected" ? "Corrected" : field.status === "confirmed" ? "Confirmed" : field.status === "rejected" ? "Rejected" : field.status === "missing" ? "Missing" : "Suggested";
  return (
    <article className="rounded-3xl border border-slate-700/35 bg-black/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c8d2e6]">{field.fieldKey.replaceAll("_", " ")}</p>
          <p className="mt-2 text-lg font-semibold text-[#f6f8ff]">{valueLabel(field.value) || "Missing"}</p>
        </div>
        <StatusBadge value={`${statusLabel} · ${Math.round(field.confidence * 100)}%`} />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{field.explanation}</p>
      <p className="mt-1 text-xs text-muted-foreground">Evidence: {field.supportingEvidenceIds.length || 0} source record(s){field.conflictingEvidenceIds?.length ? ` · ${field.conflictingEvidenceIds.length} conflict(s)` : ""}</p>
      {field.reviewRequired ? <p className="mt-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Review recommended before this value is used broadly.</p> : null}
      {field.alternatives?.length ? <p className="mt-2 text-xs text-muted-foreground">Alternatives: {field.alternatives.map(valueLabel).filter(Boolean).join(" · ")}</p> : null}
      <details className="mt-3 rounded-2xl border border-slate-700/35 bg-slate-950/35 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-[#edf3ff]">Evidence, history, and impact</summary>
        <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
          <p>Source record: {field.sourceRecordId ? "Captured from supplier page" : "Not linked"}</p>
          <p>Decision history: current revision {field.revision}{field.reviewedAt ? ` · reviewed ${new Date(field.reviewedAt).toLocaleDateString()}` : ""}</p>
          <p>Correction impact: changes to {field.fieldKey.replaceAll("_", " ")} can update marketplace draft readiness, Product completeness, and generated recommendations while preserving manually edited listing fields.</p>
        </div>
      </details>
      {editing ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={value} onChange={(event) => setValue(event.target.value)} className="min-h-10 flex-1 rounded-full border border-slate-700/60 bg-zinc-950/70 px-4 text-sm text-[#f6f8ff] outline-none transition focus:border-[#66708d]" aria-label={`Correct ${field.fieldKey.replaceAll("_", " ")}`} />
          <button type="button" disabled={disabled} onClick={() => { onDecide(field, "corrected", value); setEditing(false); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#66708d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#77829f] disabled:opacity-50"><Save size={14} />Save</button>
          <button type="button" disabled={disabled} onClick={() => setEditing(false)} className="rounded-full border border-slate-700/60 px-4 py-2 text-sm font-semibold text-[#edf3ff] transition hover:border-slate-400/60">Cancel</button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={disabled || field.status === "confirmed"} onClick={() => onDecide(field, "confirmed", field.value)} className="rounded-full border border-slate-700/60 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-[#edf3ff] transition hover:border-slate-400/60 disabled:opacity-50">Approve</button>
          <button type="button" disabled={disabled} onClick={() => setEditing(true)} className="rounded-full border border-slate-700/60 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-[#edf3ff] transition hover:border-slate-400/60 disabled:opacity-50">Edit</button>
          <button type="button" disabled={disabled || field.status === "rejected"} onClick={() => onDecide(field, "rejected", field.value)} className="rounded-full border border-slate-700/60 bg-zinc-950/60 px-3 py-1.5 text-xs font-semibold text-[#edf3ff] transition hover:border-slate-400/60 disabled:opacity-50">Reject</button>
        </div>
      )}
    </article>
  );
}

function valueLabel(value: ProductKnowledgeField["value"]) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    const variants = Array.isArray(value.variants) ? value.variants.length : Array.isArray(value.rows) ? value.rows.length : undefined;
    if (variants !== undefined) return `${variants} variant option(s)`;
    return Object.entries(value).map(([key, entry]) => `${key}: ${Array.isArray(entry) ? entry.join(", ") : String(entry)}`).join(" · ");
  }
  return String(value);
}

function ProductDnaCapsule({ item }: { item: ProductExperience }) {
  const dnaTags = item.intelligence.dna.length ? item.intelligence.dna : [{ tag: "Needs attention" as const, reason: "Faust needs more product history before stronger DNA traits become reliable." }];
  const liveChannels = item.marketplaces.filter((marketplace) => marketplace.status === "live").length;
  const dnaProfile = buildProductDnaProfile(item);
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

        <ProductDnaCore profile={dnaProfile} />

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
        <div className="grid gap-2 text-xs text-muted-foreground">
          <p className="font-semibold uppercase tracking-[0.16em] text-[#c8d2e6]">Strengthen Product DNA</p>
          <div className="flex flex-wrap items-center gap-2">
            {dnaProfile.missingInputs.map((input) => (
              <span key={input} className="rounded-full border border-slate-600/40 bg-black/30 px-3 py-1.5 text-[#edf3ff]">{input}</span>
            ))}
          </div>
          <div className={dnaProfile.missingInputs.length ? "hidden" : "flex flex-wrap items-center gap-2"}>
          {lifecycle.map((event, index) => (
            <span key={`${event}-${index}`} className="inline-flex items-center gap-2">
              <span className="rounded-full border border-slate-600/40 bg-black/30 px-3 py-1.5 text-[#edf3ff]">{event}</span>
              {index < lifecycle.length - 1 ? <span className="text-slate-600">→</span> : null}
            </span>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductDnaCore({ profile }: { profile: ProductDnaProfile }) {
  const scale = 0.78 + profile.strengthScore / 100 * 0.28;
  const particleCount = Math.max(4, Math.round(5 + profile.strengthScore / 10));
  const completedSignals = Object.entries(profile.confidenceBreakdown).filter(([, score]) => score >= 70).length;
  const coreTone = profile.stage === "initial"
    ? "from-slate-950 via-slate-900 to-slate-700"
    : profile.stage === "forming"
      ? "from-slate-950 via-[#26314a] to-[#66708d]"
      : profile.stage === "developing"
        ? "from-[#0c111b] via-[#56627f] to-[#c8d2e6]"
        : profile.stage === "strong"
          ? "from-black via-[#1d2538] to-[#dce5f7]"
          : "from-[#05070a] via-[#66708d] to-white";
  return (
    <div className="dna-core-stage relative mx-auto grid min-h-[300px] w-full max-w-[380px] place-items-center">
      <div className="absolute inset-x-8 top-8 h-8 rounded-full border border-slate-500/35 bg-slate-300/10 blur-[1px]" />
      <div className="dna-capsule relative h-[286px] w-[176px] rounded-[5rem] border border-slate-400/35 bg-[linear-gradient(90deg,rgba(200,210,230,.08),rgba(200,210,230,.22),rgba(40,48,65,.2))] shadow-[0_0_50px_rgba(102,112,141,.22),inset_0_0_30px_rgba(200,210,230,.12)]">
        <div className="absolute inset-3 rounded-[5rem] border border-slate-200/10 bg-black/30 backdrop-blur-sm" />
        <div className="absolute inset-6 rounded-[5rem] bg-[radial-gradient(circle_at_50%_45%,rgba(237,243,255,.18),rgba(102,112,141,.1)_42%,transparent_72%)]" />
        <div
          className="dna-core absolute left-1/2 top-[45%] h-[116px] w-[116px] -translate-x-1/2 rounded-[42%_58%_49%_51%/48%_44%_56%_52%] shadow-[0_0_42px_rgba(200,210,230,.22),inset_0_0_28px_rgba(255,255,255,.12)]"
          role="img"
          aria-label={`Product Intelligence ${profile.stageLabel}, ${profile.strengthScore}% knowledge strength`}
          tabIndex={0}
          style={{ transform: `translateX(-50%) scale(${scale})` }}
        >
          <div className={`absolute inset-0 rounded-[inherit] bg-gradient-to-br ${coreTone} opacity-95`} />
          <div className="absolute inset-[10%] rounded-[inherit] border border-white/15 bg-[radial-gradient(circle_at_36%_28%,rgba(255,255,255,.55),transparent_18%),radial-gradient(circle_at_65%_68%,rgba(200,210,230,.18),transparent_42%)]" />
          <div className="absolute left-[24%] top-[18%] h-[70%] w-[9%] rotate-[-24deg] rounded-full bg-[#c8d2e6]/45 blur-[1px]" />
          <div className="absolute left-[52%] top-[14%] h-[74%] w-[6%] rotate-[18deg] rounded-full bg-[#edf3ff]/25 blur-[1px]" />
          <div className="absolute inset-[-12px] rounded-full border border-[#c8d2e6]/20" />
          <div className="absolute inset-[-24px] rounded-full border border-[#66708d]/10" />
        </div>
        <div className="absolute inset-7" aria-hidden="true">
          {Array.from({ length: particleCount }).map((_, index) => (
            <span
              className="core-particle"
              key={index}
              style={{
                "--particle-index": index,
                "--particle-left": `${18 + (index % 5) * 16}%`,
                "--particle-top": `${14 + (index % 4) * 18}%`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="absolute inset-x-[-18px] bottom-7 h-5 rounded-full border border-slate-400/25 bg-slate-950/70" />
      </div>
      <div className="absolute bottom-2 rounded-full border border-slate-600/45 bg-black/55 px-4 py-2 text-center shadow-lg shadow-black/40">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Knowledge Strength</p>
        <p className="font-heading text-xl font-semibold text-[#f6f8ff]">{profile.stageLabel} · {profile.strengthScore}%</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{completedSignals}/8 signals developed</p>
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
