"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OperatingData } from "@/domain/business";

const button = "rounded-full border border-sky-950/60 bg-zinc-950/50 px-3 py-1.5 text-xs font-medium transition hover:border-sky-400/50 hover:text-white disabled:opacity-50";
const input = "faust-field faust-focus mt-1 w-full px-3 py-2 text-sm";

export function ListingsActionsPanel({ data }: { data: OperatingData }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const variant = data.variants[0];
  const draft = data.channelListingDrafts?.[0];
  const manualDraft = data.channelListingDrafts?.find((entry) => entry.publishMode !== "adapter") || draft;
  const publishedDraft = data.channelListingDrafts?.find((entry) => entry.status === "published") || draft;

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action); setMessage("");
    try {
      const response = await fetch("/api/listings/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, idempotencyKey: crypto.randomUUID(), ...payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Listings action failed.");
      setMessage(`Listings ${action.replaceAll("-", " ")} saved.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Listings action failed.");
    } finally {
      setBusy("");
    }
  }

  return <section aria-label="Listings workflows" className="faust-surface overflow-hidden">
    <h2 className="border-b border-sky-950/45 px-5 py-4 font-semibold">Listings Workflows</h2>
    <div className="grid gap-5 p-5 lg:grid-cols-2">
      <form className="faust-card p-4" onSubmit={(event) => { event.preventDefault(); const fields = new FormData(event.currentTarget); void run("create-five-drafts", { variantId: String(fields.get("variantId")), physicalSku: String(fields.get("physicalSku")), basePrice: Number(fields.get("basePrice")), imageUrls: [String(fields.get("imageUrl"))].filter(Boolean) }); }}>
        <h3 className="font-semibold">Create five channel drafts</h3>
        <input type="hidden" name="variantId" value={variant?.id || ""} />
        <label className="mt-3 block text-xs">Physical SKU<input className={input} name="physicalSku" defaultValue={variant?.sku || ""} /></label>
        <label className="mt-3 block text-xs">Base price<input className={input} name="basePrice" defaultValue={variant?.defaultSalePrice || 0} /></label>
        <label className="mt-3 block text-xs">Image URL<input className={input} name="imageUrl" defaultValue="/placeholder-product.png" /></label>
        <button className={`${button} mt-4`} disabled={!variant || busy === "create-five-drafts"}>Create 5 channel drafts</button>
      </form>
      <div className="faust-card p-4">
        <h3 className="font-semibold">Publish and extension workflow</h3>
        <p className="mt-2 text-xs text-muted-foreground">Supported adapters publish through the mock provider. Unsupported channels enter guided extension/manual mode until credentials are connected.</p>
        <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={!draft || busy === "publish-draft"} onClick={() => draft && run("publish-draft", { draftId: draft.id })}>Publish selected draft</button><button className={button} disabled={!manualDraft} onClick={() => manualDraft && run("confirm-external", { draftId: manualDraft.id, externalListingId: `${manualDraft.marketplace.toUpperCase()}-MANUAL-1`, externalUrl: `https://example.test/${manualDraft.marketplace.toLowerCase()}/manual-1` })}>Confirm external ID/URL</button></div>
      </div>
      <div className="faust-card p-4">
        <h3 className="font-semibold">Inventory sync and risk locks</h3>
        <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={!publishedDraft} onClick={() => publishedDraft && run("sync-quantity", { draftId: publishedDraft.id })}>Sync quantity</button><button className={button} disabled={!publishedDraft} onClick={() => publishedDraft && run("sync-quantity", { draftId: publishedDraft.id, quantity: 99 })}>Force oversell risk lock</button><button className={button} disabled={!publishedDraft} onClick={() => publishedDraft && run("retry-sync", { draftId: publishedDraft.id })}>Retry failed sync</button></div>
      </div>
      <div className="faust-card p-4">
        <h3 className="font-semibold">Pause, delist, and sold coordination</h3>
        <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={!draft} onClick={() => draft && run("pause-draft", { draftId: draft.id, reason: "Seasonal pause" })}>Pause listing</button><button className={button} disabled={!draft} onClick={() => draft && run("delist-draft", { draftId: draft.id, reason: "Manual delist" })}>Delist listing</button><button className={button} disabled={!draft} onClick={() => draft && run("coordinate-sold", { draftId: draft.id })}>Coordinate sold item</button></div>
      </div>
    </div>
    {message && <p role="status" className="border-t border-sky-950/45 px-5 py-3 text-sm text-sky-100">{message}</p>}
  </section>;
}
