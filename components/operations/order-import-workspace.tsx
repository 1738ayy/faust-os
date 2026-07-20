"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Marketplace, OperatingData } from "@/domain/business";

type Preview = {
  batchId: string;
  accepted: number;
  rejected: number;
  errors: { row: number; message: string }[];
  duplicates: string[];
  reviews: { id: string; itemTitle: string; externalOrderId: string; externalSku?: string; likelyVariantIds: string[]; matchConfidence: number }[];
};

const field = "faust-field faust-focus px-3 py-2 text-sm";
const smallButton = "rounded-full border border-sky-950/60 bg-zinc-950/50 px-3 py-1.5 text-xs font-medium transition hover:border-sky-400/50 hover:text-white";
const primaryButton = "rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:opacity-60";

export function OrderImportWorkspace({ data }: { data: OperatingData }) {
  const router = useRouter();
  const [marketplace, setMarketplace] = useState<Marketplace>("Manual");
  const [preview, setPreview] = useState<Preview>();
  const [activeBatchId, setActiveBatchId] = useState(data.orderImportBatches?.[0]?.id || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const batches = data.orderImportBatches || [];
  const reviews = data.orderImportReviews || [];
  const activeBatch = batches.find((batch) => batch.id === activeBatchId) || batches[0];

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("marketplace", marketplace);
    setBusy(true);
    setMessage("Parsing and validating CSV...");
    try {
      const response = await fetch("/api/orders/import", { method: "POST", body: form });
      const next = await response.json();
      if (!response.ok) throw new Error(next.message);
      setPreview(next);
      setActiveBatchId(next.batchId);
      setMessage(next.errors.length || next.duplicates.length || next.reviews.length ? "Resolve all row issues before confirmation." : "Ready to confirm import.");
      formElement.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function post(endpoint: string, body: Record<string, unknown>) {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Request failed.");
    router.refresh();
    return result;
  }

  async function resolve(reviewId: string, action: string, variantId?: string) {
    try {
      await post("/api/orders/import/review", { reviewId, action, variantId });
      setMessage("Import review updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review update failed.");
    }
  }

  async function batchAction(action: string, batchId = activeBatch?.id) {
    if (!batchId) return;
    try {
      await post(action === "confirm" ? "/api/orders/import/confirm" : "/api/orders/import/batches", { action, batchId });
      setMessage(`Import batch ${action} complete.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Batch action failed.");
    }
  }

  return (
    <section className="faust-surface p-5" aria-label="Order import workspace">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sky-100">Order import</p>
          <h2 className="mt-2 text-2xl font-semibold">Bring marketplace orders into Faust safely.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Upload a CSV, resolve unmatched items, confirm clean rows, and keep a history of every import batch.
          </p>
        </div>
        {activeBatch && (
          <div className="faust-card px-4 py-3 text-right text-xs text-muted-foreground">
            <b className="text-foreground">{activeBatch.filename}</b>
            <p className="mt-1 capitalize">{activeBatch.status.replaceAll("_", " ")}</p>
          </div>
        )}
      </div>

      <form className="mt-5 flex flex-wrap items-center gap-3" onSubmit={upload}>
        <input required name="file" type="file" accept=".csv,text/csv" className="text-sm" />
        <select value={marketplace} onChange={(event) => setMarketplace(event.target.value as Marketplace)} className={field}>
          {["Manual", "Depop", "eBay", "Etsy", "Mercari", "Poshmark"].map((name) => <option key={name}>{name}</option>)}
        </select>
        <button disabled={busy} className={primaryButton}>{busy ? "Checking file..." : "Preview orders"}</button>
      </form>

      {message && <p role="status" className="faust-card mt-4 whitespace-pre-wrap p-3 text-sm text-muted-foreground">{message}</p>}

      {preview && (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="faust-card p-4">
            <b>Latest preview</b>
            <p className="mt-2 text-sm text-muted-foreground">Accepted {preview.accepted} · Rejected {preview.rejected}</p>
            <p className="text-sm text-muted-foreground">Duplicates {preview.duplicates.length} · Needs review {preview.reviews.length}</p>
          </div>
          <div className="faust-card p-4 text-xs">
            <b>Row errors</b>
            <div className="mt-2 space-y-1 text-muted-foreground">
              {preview.errors.map((error) => <p key={error.row}>Row {error.row}: {error.message}</p>)}
              {preview.duplicates.map((id) => <p key={id}>Duplicate order: {id}</p>)}
              {!preview.errors.length && !preview.duplicates.length && <p>No row errors found.</p>}
            </div>
          </div>
          <div className="faust-card p-4 text-xs">
            <b>Items needing review</b>
            <div className="mt-2 space-y-1 text-muted-foreground">
              {preview.reviews.map((review) => <p key={review.id}>{review.externalOrderId} · {review.itemTitle} · SKU {review.externalSku || "none"} · {Math.round(review.matchConfidence * 100)}% match</p>)}
              {!preview.reviews.length && <p>All item lines matched.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="faust-card overflow-hidden">
          <div className="border-b border-sky-950/35 p-4 text-sm font-semibold">Import batch history</div>
          {batches.map((batch) => (
            <button type="button" key={batch.id} onClick={() => setActiveBatchId(batch.id)} className={`block w-full border-b border-sky-950/30 p-4 text-left text-xs transition hover:bg-sky-400/5 ${activeBatch?.id === batch.id ? "bg-sky-400/10" : ""}`}>
              <b>{batch.filename}</b>
              <span className="ml-2 rounded-full border border-sky-950/45 bg-black/35 px-2 py-0.5 capitalize text-sky-50">{batch.status.replaceAll("_", " ")}</span>
              <p className="mt-2 text-muted-foreground">Accepted {batch.acceptedRows} · Rejected {batch.rejectedRows} · Unresolved {batch.unresolvedRows} · Failed {batch.failedRows} · Imported {batch.importedOrders}</p>
            </button>
          ))}
          {!batches.length && <p className="p-4 text-sm text-muted-foreground">No imports yet. Upload a marketplace CSV when orders are ready to process.</p>}
        </div>

        <div className="faust-card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-sky-950/35 p-4">
            <b className="mr-auto text-sm">Batch detail</b>
            {activeBatch && (
              <>
                <button className={smallButton} onClick={() => batchAction("confirm")}>Confirm import</button>
                <button className={smallButton} onClick={() => batchAction("retry")}>Retry failed rows</button>
                <button className={smallButton} onClick={() => batchAction("reopen")}>Reopen review</button>
                <button className={smallButton} onClick={() => batchAction("archive")}>Archive</button>
                <button className={smallButton} onClick={() => setMessage(`row,error\n${activeBatch.rows.filter((row) => row.error).map((row) => `${row.rowNumber},"${row.error}"`).join("\n") || "none,none"}`)}>Download error report</button>
              </>
            )}
          </div>
          {activeBatch ? (
            <div className="max-h-[460px] overflow-auto divide-y divide-sky-950/30">
              {activeBatch.rows.map((row) => {
                const review = reviews.find((item) => item.id === row.reviewId);
                return (
                  <div className="grid gap-3 p-4 text-xs md:grid-cols-[1fr_auto]" key={row.id}>
                    <div>
                      <b>Row {row.rowNumber}: {row.externalOrderId}</b>
                      <span className="ml-2 rounded-full border border-sky-950/45 bg-black/35 px-2 py-0.5 capitalize text-sky-50">{row.status.replaceAll("_", " ")}</span>
                      <p className="mt-2 text-muted-foreground">{row.itemTitle} x{row.quantity} · SKU {row.externalSku || "none"} · listing {row.externalListingId || "none"}</p>
                      {row.error && <p className="mt-1 text-sky-200">{row.error}</p>}
                      {row.orderId && <p className="mt-1 text-muted-foreground">Created order {row.orderId}</p>}
                      {review && <p className="mt-1 text-muted-foreground">Confidence {Math.round(review.matchConfidence * 100)}% · {review.state.replaceAll("_", " ")}</p>}
                    </div>
                    {review && (
                      <div className="flex flex-wrap gap-2">
                        {data.variants[0] && <button className={smallButton} onClick={() => resolve(review.id, "link_variant", data.variants[0].id)}>Link variant</button>}
                        <button className={smallButton} onClick={() => resolve(review.id, "create_variant")}>Create product/variant</button>
                        <button className={smallButton} onClick={() => resolve(review.id, "non_inventory")}>Non-inventory</button>
                        <button className={smallButton} onClick={() => resolve(review.id, "ignore")}>Ignore row</button>
                        <button className={smallButton} onClick={() => resolve(review.id, "cancel")}>Cancel row</button>
                        <button className={smallButton} onClick={() => resolve(review.id, "reopen")}>Reopen</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Select an import batch to inspect rows and review items.</p>
          )}
        </div>
      </div>
    </section>
  );
}
