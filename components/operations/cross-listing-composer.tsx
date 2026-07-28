"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChannelListingDraft, Marketplace, MarketplaceListingDraftField, OperatingData, ProductImageRecord } from "@/domain/business";
import { availableUnits, money } from "@/lib/business-calculations";
import { activeVariants } from "@/lib/product-state";

type ManagedMarketplace = Exclude<Marketplace, "Manual">;
type EditableValue = MarketplaceListingDraftField["currentValue"];

const marketplaces: ManagedMarketplace[] = ["Depop", "eBay", "Etsy", "Mercari", "Poshmark"];
const button = "rounded-full border border-slate-700/60 bg-zinc-950/60 px-3 py-2 text-xs font-semibold text-[#edf3ff] transition hover:border-[#9aa8c7] hover:bg-[#66708d]/25 disabled:cursor-not-allowed disabled:opacity-50";
const primary = "rounded-full bg-[#66708d] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-950/30 transition hover:bg-[#74809e] disabled:cursor-not-allowed disabled:opacity-50";
const fieldClass = "faust-field faust-focus mt-2 w-full px-3 py-2 text-sm";

function labelForSource(source: string) {
  const labels: Record<string, string> = {
    product: "Product",
    variant: "Variant",
    mapping: "Marketplace mapping",
    system_default: "System default",
    account_default: "Account default",
    category_default: "Category default",
    product_override: "Product override",
    ai_suggestion: "Suggested",
    user_edit: "Edited",
  };
  return labels[source] || source.replaceAll("_", " ");
}

function valueToString(value: EditableValue) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function parseValue(fieldKey: string, value: string): EditableValue {
  if (fieldKey === "price" || fieldKey === "quantity" || fieldKey.includes("weight")) return Number(value || 0);
  if (fieldKey === "images") return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return value;
}

function draftFieldFallback(draft: ChannelListingDraft, fieldKey: string): MarketplaceListingDraftField {
  const raw = fieldKey === "title" ? draft.title : fieldKey === "description" ? draft.description : fieldKey === "price" ? draft.price : fieldKey === "category" ? draft.category : fieldKey === "quantity" ? draft.quantity : fieldKey === "images" ? draft.imageUrls : draft.attributes[fieldKey] ?? null;
  const value = Array.isArray(raw) ? raw : typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" || raw === null ? raw : String(raw);
  return { id: `${draft.id}:${fieldKey}`, draftId: draft.id, fieldKey, generatedValue: value, currentValue: value, source: "mapping", sourcePath: `channelListingDrafts.${fieldKey}`, confidence: 0.85, isOverridden: false, validationState: value === null || value === "" ? "blocked" : "valid", validationMessage: value === null || value === "" ? "Missing value" : null, createdAt: draft.createdAt, updatedAt: draft.updatedAt || draft.createdAt };
}

function fieldsForDraft(data: OperatingData, draft?: ChannelListingDraft) {
  if (!draft) return [];
  const persisted = (data.marketplaceListingDraftFields || []).filter((field) => field.draftId === draft.id);
  const keys = ["title", "description", "category", "price", "quantity", "condition", "brand", "style", "shippingService", "images"];
  const byKey = new Map(persisted.map((field) => [field.fieldKey, field]));
  for (const key of keys) if (!byKey.has(key)) byKey.set(key, draftFieldFallback(draft, key));
  return [...byKey.values()];
}

function FieldEditor({ field, onSave, onReset, busy }: { field: MarketplaceListingDraftField; onSave: (fieldKey: string, value: EditableValue, mode: "draft" | "product") => void; onReset: (fieldKey: string) => void; busy: string }) {
  const [value, setValue] = useState(valueToString(field.currentValue));
  const isLong = field.fieldKey === "description" || value.length > 80;
  const limit = field.fieldKey === "title" ? 80 : field.fieldKey === "description" ? 5000 : undefined;
  const changed = value !== valueToString(field.currentValue);
  return <article className="rounded-3xl border border-slate-700/55 bg-black/20 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold capitalize">{field.fieldKey.replaceAll("_", " ")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Source: <span className="rounded-full border border-slate-600/70 px-2 py-0.5 text-[#edf3ff]">{labelForSource(field.source)}</span>{typeof field.confidence === "number" ? ` · ${Math.round(field.confidence * 100)}% confidence` : ""}</p>
      </div>
      <span className={`rounded-full border px-2.5 py-1 text-xs ${field.validationState === "blocked" ? "border-red-400/40 text-red-200" : field.validationState === "warning" ? "border-amber-300/40 text-amber-100" : "border-[#9aa8c7]/35 text-[#edf3ff]"}`}>{field.validationState}</span>
    </div>
    <label className="mt-3 block text-xs text-muted-foreground">
      Current value
      {isLong ? <textarea className={`${fieldClass} min-h-28`} value={value} onChange={(event) => setValue(event.target.value)} /> : <input className={fieldClass} value={value} onChange={(event) => setValue(event.target.value)} />}
    </label>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{limit ? `${value.length} / ${limit} characters` : field.sourcePath || "Generated by marketplace intelligence"}</span>
      {field.validationMessage && <span>{field.validationMessage}</span>}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button className={primary} disabled={!changed || busy === field.fieldKey} onClick={() => onSave(field.fieldKey, parseValue(field.fieldKey, value), "draft")}>Save draft edit</button>
      <button className={button} disabled={!changed || busy === field.fieldKey} onClick={() => onSave(field.fieldKey, parseValue(field.fieldKey, value), "product")}>Remember for product</button>
      <button className={button} disabled={busy === field.fieldKey} onClick={() => { setValue(valueToString(field.generatedValue)); onReset(field.fieldKey); }}>Reset to generated</button>
    </div>
  </article>;
}

export function CrossListingComposer({ data }: { data: OperatingData }) {
  const router = useRouter();
  const products = data.products.filter((product) => product.status === "active" || product.status === "draft");
  const firstProduct = products[0];
  const [productId, setProductId] = useState(firstProduct?.id || "");
  const product = products.find((entry) => entry.id === productId) || firstProduct;
  const variants = product ? activeVariants(data).filter((variant) => variant.productId === product.id) : [];
  const variant = variants[0];
  const [marketplace, setMarketplace] = useState<ManagedMarketplace>("Depop");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const drafts = variant ? (data.channelListingDrafts || []).filter((draft) => draft.variantId === variant.id) : [];
  const draft = drafts.find((entry) => entry.marketplace === marketplace);
  const fields = fieldsForDraft(data, draft);
  const images = product ? (data.productImages || []).filter((image) => image.productId === product.id).sort((a, b) => a.position - b.position) : [];
  const balance = variant ? data.balances.find((entry) => entry.variantId === variant.id) : undefined;
  const available = balance ? availableUnits(balance) : 0;
  const priceField = fields.find((field) => field.fieldKey === "price");
  const price = Number(priceField?.currentValue || draft?.price || variant?.defaultSalePrice || 0);
  const cost = variant?.landedUnitCost || 0;
  const estimatedFees = price * (marketplace === "Poshmark" ? 0.2 : marketplace === "eBay" ? 0.1325 : marketplace === "Etsy" ? 0.095 : 0.1);
  const estimatedShipping = 7.5;
  const profit = price - estimatedFees - estimatedShipping - cost;
  const missingFields = fields.filter((field) => field.validationState === "blocked" || field.currentValue === null || field.currentValue === "");
  const tasks = draft ? (data.marketplacePublishTasks || []).filter((task) => task.draftId === draft.id) : [];

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(String(payload.fieldKey || action)); setMessage("");
    try {
      const response = await fetch("/api/listings/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, idempotencyKey: crypto.randomUUID(), ...payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Listings action failed.");
      setMessage(`${action.replaceAll("-", " ")} saved.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Listings action failed.");
    } finally {
      setBusy("");
    }
  }

  function saveField(fieldKey: string, currentValue: EditableValue, mode: "draft" | "product") {
    if (!draft) return;
    if (mode === "product") void run("save-product-override", { productId: product?.id, variantId: variant?.id, marketplace, marketplaceAccountId: draft.accountId, fieldKey, value: currentValue });
    else void run("save-draft-field", { draftId: draft.id, fieldKey, currentValue });
  }

  function saveImageOrder() {
    if (!product || !images.length) return;
    void run("save-image-order", { productId: product.id, marketplace, imageIds: images.map((image) => image.id), coverImageId: images[0].id });
  }

  return <section aria-label="Full Cross-Listing Composer" className="faust-surface overflow-hidden">
    <div className="border-b border-slate-700/45 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/70 bg-cover bg-center" style={{ backgroundImage: `url(${product?.image || images[0]?.url || "/brand/faust-snow-leopard.svg"})` }} />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#c8d2e6]">Full composer</p>
            <h2 className="mt-1 text-xl font-semibold">{product?.title || "No product selected"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">SKU {variant?.sku || "Missing SKU"} · Draft revision {(data.marketplaceListingDraftRevisions || []).filter((entry) => entry.draftId === draft?.id).length || 1} · {message || "Saved state updates after persistence succeeds."}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={() => router.refresh()}>Exit composer</button>
          <button className={button} disabled={!variant || busy === "create-five-drafts"} onClick={() => variant && run("create-five-drafts", { variantId: variant.id, physicalSku: variant.sku, imageUrls: images.map((image) => image.url) })}>Generate drafts</button>
          <button className={primary} disabled={!product || busy === "publish-product"} onClick={() => product && run("publish-product", { productId: product.id, marketplaces, inventoryStrategy: available <= 1 ? "shared" : "allocated" })}>Publish ready listings</button>
        </div>
      </div>
    </div>

    <div className="grid gap-0 xl:grid-cols-[290px_minmax(0,1fr)_330px]">
      <aside className="border-b border-slate-700/45 p-5 xl:border-b-0 xl:border-r">
        <label className="block text-xs text-muted-foreground">Product<select className={fieldClass} value={product?.id || ""} onChange={(event) => setProductId(event.target.value)}>{products.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>
        <div className="mt-5 space-y-2 text-sm">
          <SourceRow label="Title" value={product?.title} />
          <SourceRow label="Category" value={product?.category} />
          <SourceRow label="Condition" value={variant?.condition} />
          <SourceRow label="Variant" value={variant?.title} />
          <SourceRow label="Material" value={product?.tags?.find((tag) => tag.toLowerCase().includes("cotton") || tag.toLowerCase().includes("poly") || tag.toLowerCase().includes("leather"))} />
          <SourceRow label="Base price" value={money(variant?.defaultSalePrice || 0)} />
          <SourceRow label="Cost basis" value={money(cost)} />
          <SourceRow label="Quantity" value={`${available} available`} />
          <SourceRow label="Weight" value={variant?.weightOz ? `${variant.weightOz} oz` : "Missing"} />
          <SourceRow label="Images" value={`${images.length || product?.images?.length || 0} canonical images`} />
        </div>
        <div className="mt-5 rounded-3xl border border-slate-700/55 bg-black/20 p-4 text-xs text-muted-foreground">
          <b className="text-[#edf3ff]">Inventory strategy</b>
          <p className="mt-2">Available: {available}. Single-quantity products default to shared inventory; multi-quantity products can be allocated by marketplace before live connectors are enabled.</p>
        </div>
      </aside>

      <main className="p-5">
        <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Marketplace editor tabs">
          {marketplaces.map((market) => {
            const tabDraft = drafts.find((entry) => entry.marketplace === market);
            const tabFields = fieldsForDraft(data, tabDraft);
            const missing = tabFields.filter((field) => field.validationState === "blocked" || field.currentValue === "" || field.currentValue === null).length;
            return <button key={market} role="tab" aria-selected={marketplace === market} className={`${marketplace === market ? "border-[#9aa8c7] bg-[#66708d]/25" : "border-slate-700/60 bg-zinc-950/50"} rounded-full border px-3 py-2 text-xs font-semibold`} onClick={() => setMarketplace(market)}>{market} · {tabDraft?.status || "No draft"}{missing ? ` · ${missing} missing` : ""}</button>;
          })}
        </div>
        {draft ? <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">{fields.map((field) => <FieldEditor key={`${field.draftId}-${field.fieldKey}`} field={field} busy={busy} onSave={saveField} onReset={(fieldKey) => run("reset-draft-field", { draftId: draft.id, fieldKey })} />)}</div>
          <section className="rounded-3xl border border-slate-700/55 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-semibold">Marketplace image order</h3><p className="mt-1 text-xs text-muted-foreground">Uses canonical Product images only. Reordering stores references, not duplicate image files.</p></div>
              <button className={button} disabled={!images.length || busy === "save-image-order"} onClick={saveImageOrder}>Save image order</button>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">{images.map((image: ProductImageRecord, index) => <div key={image.id} className="min-w-28"><div className="h-28 rounded-2xl border border-slate-700/60 bg-cover bg-center" style={{ backgroundImage: `url(${image.url})` }} /><p className="mt-1 text-xs text-muted-foreground">{index === 0 ? "Cover" : `Image ${index + 1}`}</p></div>)}</div>
          </section>
        </div> : <div className="rounded-3xl border border-slate-700/55 p-5 text-sm text-muted-foreground">No {marketplace} draft exists yet. Generate marketplace drafts for this Product first.</div>}
      </main>

      <aside className="border-t border-slate-700/45 p-5 xl:border-l xl:border-t-0">
        <section className="rounded-3xl border border-slate-700/55 bg-black/20 p-4">
          <h3 className="font-semibold">Readiness & economics</h3>
          <SourceRow label="State" value={draft?.status || "No draft"} />
          <SourceRow label="Blocking fields" value={String(missingFields.length)} />
          <SourceRow label="List price" value={money(price)} />
          <SourceRow label="Estimated fees" value={money(estimatedFees)} />
          <SourceRow label="Shipping estimate" value={money(estimatedShipping)} />
          <SourceRow label="Cost basis" value={money(cost)} />
          <SourceRow label="Estimated profit" value={money(profit)} />
          <SourceRow label="Estimated margin" value={`${price ? ((profit / price) * 100).toFixed(1) : "0.0"}%`} />
        </section>
        <section className="mt-4 rounded-3xl border border-slate-700/55 bg-black/20 p-4">
          <h3 className="font-semibold">Final review</h3>
          <p className="mt-2 text-xs text-muted-foreground">Blocked marketplaces stay visible. Ready adapter drafts publish through deterministic mock tasks; extension/manual channels queue guided steps.</p>
          <div className="mt-3 space-y-2">{drafts.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-2 text-xs"><span>{entry.marketplace}</span><span>{entry.status} · {money(entry.price)} · qty {entry.quantity}</span></div>)}</div>
        </section>
        <section className="mt-4 rounded-3xl border border-slate-700/55 bg-black/20 p-4">
          <h3 className="font-semibold">Publishing queue</h3>
          <div className="mt-3 space-y-3">{tasks.length ? tasks.map((task) => <div key={task.id} className="rounded-2xl border border-slate-700/45 p-3 text-xs"><div className="flex justify-between gap-2"><b>{marketplace}</b><span>{task.status}</span></div><p className="mt-1 text-muted-foreground">Attempt {task.attemptCount} · {task.retryable ? "retryable" : "final"}</p>{task.failureMessage && <p className="mt-1 text-muted-foreground">{task.failureMessage}</p>}<button className={`${button} mt-2`} disabled={busy === "retry-publish-task"} onClick={() => run("retry-publish-task", { taskId: task.id })}>Retry task</button></div>) : <p className="text-xs text-muted-foreground">No task for this marketplace yet.</p>}</div>
        </section>
      </aside>
    </div>
  </section>;
}

function SourceRow({ label, value }: { label: string; value: unknown }) {
  const complete = value !== undefined && value !== null && value !== "";
  return <div className="flex items-start justify-between gap-3 border-b border-slate-700/35 py-2 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><span className="text-right">{complete ? String(value) : "Missing"} <span className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] ${complete ? "border-[#9aa8c7]/30 text-[#edf3ff]" : "border-amber-300/40 text-amber-100"}`}>{complete ? "Complete" : "Missing"}</span></span></div>;
}
