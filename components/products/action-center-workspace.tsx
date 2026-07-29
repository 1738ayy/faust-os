"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Check, ClipboardCheck, Layers3, Play, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MetricCard, PrimaryButton, SecondaryButton, StatusBadge } from "@/components/faust/design-system";
import type { ProductPipeline, ProductWorkItem, WorkSeverity } from "@/lib/product-pipeline";
import { productPipelineQueueItemId, productPipelineStageLabel, productPipelineStages } from "@/lib/product-pipeline";
import { money } from "@/lib/business-calculations";

function severityTone(severity: WorkSeverity): "danger" | "warning" | "info" | "neutral" {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  if (severity === "medium") return "info";
  return "neutral";
}

async function runWorkItem(item: ProductWorkItem) {
  if (item.action.type === "open") return;
  if (item.action.type === "approve_knowledge") {
    const response = await fetch("/api/products/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve-knowledge-facts", productId: item.action.productId, fieldKeys: item.action.fieldKeys }) });
    const body = await response.json();
    if (!response.ok || body.ok === false) throw new Error(body.message || "Could not approve Product Knowledge.");
    return;
  }
  if (item.action.type === "approve_cover") {
    const response = await fetch("/api/products/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review-image-intelligence", productId: item.action.productId, imageAction: "approve_cover" }) });
    const body = await response.json();
    if (!response.ok || body.ok === false) throw new Error(body.message || "Could not approve cover.");
    return;
  }
  if (item.action.type === "exclude_image") {
    const response = await fetch("/api/products/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review-image-intelligence", productId: item.action.productId, imageId: item.action.imageId, imageAction: "exclude_from_publishing" }) });
    const body = await response.json();
    if (!response.ok || body.ok === false) throw new Error(body.message || "Could not exclude image.");
    return;
  }
  if (item.action.type === "generate_drafts") {
    const response = await fetch("/api/listings/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create-five-drafts", variantId: item.action.variantId, basePrice: item.action.basePrice || undefined, imageUrls: item.action.imageUrls, idempotencyKey: crypto.randomUUID() }) });
    if (!response.ok) throw new Error((await response.json()).message || "Could not generate drafts.");
    return;
  }
  if (item.action.type === "publish_product") {
    const response = await fetch("/api/listings/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish-product", productId: item.action.productId, idempotencyKey: crypto.randomUUID() }) });
    if (!response.ok) throw new Error((await response.json()).message || "Could not publish product.");
  }
}

async function recordPipelineAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/product-pipeline/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok || body.ok === false) throw new Error(body.message || "Could not record pipeline action.");
  return body;
}

function bulkOperationType(label: string) {
  if (/draft/i.test(label)) return "generate_drafts";
  if (/publish/i.test(label)) return "publish_ready_products";
  return "approve_supplier_facts";
}

export function ActionCenterWorkspace({ pipeline }: { pipeline: ProductPipeline }) {
  const router = useRouter();
  const [activeKind, setActiveKind] = useState<string>("all");
  const [sessionMode, setSessionMode] = useState(false);
  const [busy, startTransition] = useTransition();
  const filteredWork = useMemo(() => {
    const source = sessionMode ? pipeline.summary.session.items : pipeline.workItems;
    return activeKind === "all" ? source : source.filter((item) => item.kind === activeKind);
  }, [activeKind, pipeline.summary.session.items, pipeline.workItems, sessionMode]);
  const kinds = [...new Set(pipeline.workItems.map((item) => item.kind))];
  const bulkSafe = pipeline.workItems.filter((item) => ["review_material", "review_category", "review_cover", "exclude_image"].includes(item.kind) && item.action.type !== "open");
  const readyDrafts = pipeline.workItems.filter((item) => item.kind === "generate_drafts");
  const readyPublish = pipeline.workItems.filter((item) => item.kind === "publish_ready");

  const run = (label: string, items: ProductWorkItem[]) => {
    if (!items.length) return;
    startTransition(async () => {
      try {
        for (const item of items) await runWorkItem(item);
        await recordPipelineAction({ action: "record-bulk-operation", operationType: bulkOperationType(label), queueItemIds: items.map((item) => productPipelineQueueItemId(item.id)), productIds: [...new Set(items.map((item) => item.productId))], resultSummary: label });
        toast.success(label);
        router.refresh();
      } catch (error) {
        toast.error("Action Center stopped", { description: error instanceof Error ? error.message : "Review the item and retry." });
      }
    });
  };

  const startSession = () => {
    startTransition(async () => {
      try {
        await recordPipelineAction({ action: "start-review-session" });
        setSessionMode(true);
        toast.success("Review session started");
        router.refresh();
      } catch (error) {
        toast.error("Could not start Review Session", { description: error instanceof Error ? error.message : "Try again from Action Center." });
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-700/45 bg-zinc-950/60 p-5 shadow-2xl shadow-black/25 backdrop-blur">
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr] xl:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#c8d2e6]"><Sparkles size={14} />Highest-value action</p>
            <h2 className="mt-3 text-2xl font-semibold">{pipeline.recommended ? pipeline.recommended.title : "Pipeline is clear."}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {pipeline.recommended ? `${pipeline.recommended.detail} Expected benefit: ${pipeline.recommended.expectedBenefit}. Estimated effort: ${pipeline.recommended.estimatedEffortSeconds} seconds.` : "No products need immediate attention. Keep importing, publishing, and monitoring."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 xl:justify-end">
            {pipeline.recommended?.action.type === "open" ? <PrimaryButton href={pipeline.recommended.href}>{pipeline.recommended.suggestedAction}<ArrowRight size={15} /></PrimaryButton> : pipeline.recommended ? <button disabled={busy} onClick={() => run(pipeline.recommended!.suggestedAction, [pipeline.recommended!])} className="faust-action px-4 py-2 text-sm disabled:opacity-50">{pipeline.recommended.suggestedAction}<ArrowRight size={15} /></button> : <PrimaryButton href="/sourcing">Import product</PrimaryButton>}
            <button type="button" onClick={() => sessionMode ? setSessionMode(false) : startSession()} className="faust-secondary-action px-4 py-2 text-sm"><Play size={15} />{sessionMode ? "Exit session" : "Start session"}</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Imported today" value={pipeline.summary.today.imported} detail="new product records" />
        <MetricCard label="Ready" value={pipeline.summary.today.ready} detail="ready or ready to publish" />
        <MetricCard label="Published" value={pipeline.summary.today.published} detail="live or monitoring" />
        <MetricCard label="Sold" value={pipeline.summary.today.sold} detail="products with sales" />
        <MetricCard label="Blocked" value={pipeline.summary.today.blocked} detail="downstream blockers" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="faust-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Pipeline</h2>
              <p className="mt-1 text-sm text-muted-foreground">Every Product sits in one lifecycle stage.</p>
            </div>
            <StatusBadge value={`${pipeline.products.length} products`} tone="info" />
          </div>
          <div className="mt-5 grid gap-2">
            {productPipelineStages.map((stage) => (
              <div key={stage} className="grid grid-cols-[150px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-700/35 bg-black/25 p-3">
                <p className="text-sm font-medium">{productPipelineStageLabel(stage)}</p>
                <div className="h-2 rounded-full bg-slate-900">
                  <div className="h-full rounded-full bg-[#66708d] shadow-[0_0_18px_rgba(102,112,141,.45)]" style={{ width: `${Math.min(100, pipeline.products.length ? pipeline.summary.stageCounts[stage] / pipeline.products.length * 100 : 0)}%` }} />
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{pipeline.summary.stageCounts[stage]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="faust-surface p-5">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-[#c8d2e6]" />
            <div>
              <h2 className="text-xl font-semibold">Review Session</h2>
              <p className="mt-1 text-sm text-muted-foreground">{pipeline.summary.session.productCount} products · about {pipeline.summary.session.estimatedMinutes} minute(s) · goal: {pipeline.summary.session.goal}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <button disabled={busy || bulkSafe.length === 0} onClick={() => run(`${bulkSafe.length} safe review action(s) applied`, bulkSafe)} className="faust-action justify-center px-4 py-2 text-sm disabled:opacity-50"><Check size={15} />Approve safe Product Knowledge</button>
            <button disabled={busy || readyDrafts.length === 0} onClick={() => run(`${readyDrafts.length} product(s) drafted`, readyDrafts)} className="faust-secondary-action justify-center px-4 py-2 text-sm disabled:opacity-50"><Layers3 size={15} />Generate ready drafts</button>
            <button disabled={busy || readyPublish.length === 0} onClick={() => run(`${readyPublish.length} product(s) queued for publishing`, readyPublish)} className="faust-secondary-action justify-center px-4 py-2 text-sm disabled:opacity-50"><Send size={15} />Publish everything ready</button>
          </div>
        </div>
      </section>

      <section className="faust-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h2 className="text-xl font-semibold">Action Center</h2>
            <p className="mt-1 text-sm text-muted-foreground">{pipeline.summary.inboxCounts.total} open task(s): {pipeline.summary.inboxCounts.critical} critical · {pipeline.summary.inboxCounts.high} high · {pipeline.summary.inboxCounts.medium} medium · {pipeline.summary.inboxCounts.low} low.</p>
          </div>
          <button onClick={() => setActiveKind("all")} className={`rounded-full border px-3 py-1.5 text-xs ${activeKind === "all" ? "border-slate-400/50 bg-[#66708d]/20" : "border-slate-700/60"}`}>All</button>
          {kinds.map((kind) => <button key={kind} onClick={() => setActiveKind(kind)} className={`rounded-full border px-3 py-1.5 text-xs ${activeKind === kind ? "border-slate-400/50 bg-[#66708d]/20" : "border-slate-700/60"}`}>{kind.replaceAll("_", " ")}</button>)}
        </div>
        <div className="mt-5 grid gap-3">
          {filteredWork.map((item) => (
            <article key={item.id} className="grid gap-4 rounded-3xl border border-slate-700/40 bg-black/30 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={item.severity} tone={severityTone(item.severity)} />
                  <StatusBadge value={productPipelineStageLabel(item.stage)} tone="neutral" />
                  {item.blocksDownstream ? <StatusBadge value="blocks downstream" tone="warning" /> : null}
                </div>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.productTitle} · {item.sku} — {item.detail}</p>
                <p className="mt-2 text-xs text-[#c8d2e6]">{item.estimatedEffortSeconds} sec · {item.expectedBenefit}</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <SecondaryButton href={item.href}>Open</SecondaryButton>
                {item.action.type === "open" ? null : <button disabled={busy} onClick={() => run(item.suggestedAction, [item])} className="faust-action px-4 py-2 text-sm disabled:opacity-50">{item.suggestedAction}</button>}
              </div>
            </article>
          ))}
          {!filteredWork.length ? <div className="rounded-3xl border border-dashed border-slate-700/50 p-8 text-center text-sm text-muted-foreground">No tasks in this filter. Pipeline looks calm—tiny miracle, enjoy it.</div> : null}
        </div>
      </section>

      <section className="faust-surface p-5">
        <h2 className="text-xl font-semibold">Product Queue</h2>
        <p className="mt-1 text-sm text-muted-foreground">Prioritized by blockers, revenue potential, readiness, inventory, confidence, affected drafts, and closeness to publishing.</p>
        <div className="mt-5 grid gap-3">
          {pipeline.products.slice(0, 20).map((product) => (
            <Link key={product.variantId} href={product.href} className="grid gap-3 rounded-3xl border border-slate-700/35 bg-black/25 p-4 transition hover:border-slate-400/40 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold">{product.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{product.sku} · {productPipelineStageLabel(product.stage)} · readiness {product.readinessScore}% · {product.inventoryAvailable} available</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span className="rounded-full border border-slate-700/50 px-3 py-1 text-xs">Priority {product.priorityScore}</span>
                <span className="rounded-full border border-slate-700/50 px-3 py-1 text-xs">{money(product.revenuePotential)} potential</span>
                <span className="rounded-full bg-[#66708d] px-3 py-1 text-xs font-semibold text-white">{product.nextAction}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
