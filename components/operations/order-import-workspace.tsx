"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Marketplace, OperatingData } from "@/domain/business";

type Preview = { batchId: string; accepted: number; rejected: number; errors: { row: number; message: string }[]; duplicates: string[]; reviews: { id: string; itemTitle: string; externalOrderId: string; externalSku?: string; likelyVariantIds: string[]; matchConfidence: number }[] };

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
    try { await post("/api/orders/import/review", { reviewId, action, variantId }); setMessage("Import review updated."); } catch (error) { setMessage(error instanceof Error ? error.message : "Review update failed."); }
  }
  async function batchAction(action: string, batchId = activeBatch?.id) {
    if (!batchId) return;
    try { await post(action === "confirm" ? "/api/orders/import/confirm" : "/api/orders/import/batches", { action, batchId }); setMessage(`Import batch ${action} complete.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Batch action failed."); }
  }

  return <section className="border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">CSV import, review, and batch history</h2><p className="mt-1 text-sm text-muted-foreground">Upload, resolve unmatched lines, confirm, retry failed rows, reopen review, or archive finished batches.</p></div>{activeBatch && <div className="text-right text-xs text-muted-foreground"><b className="text-foreground">Batch {activeBatch.id.slice(0, 8)}</b><p>{activeBatch.status} - {activeBatch.filename}</p></div>}</div>
    <form className="mt-4 flex flex-wrap gap-3" onSubmit={upload}><input required name="file" type="file" accept=".csv,text/csv" className="text-sm" /><select value={marketplace} onChange={(event) => setMarketplace(event.target.value as Marketplace)} className="border bg-background p-2 text-sm">{["Manual","Depop","eBay","Etsy","Mercari","Poshmark"].map((name) => <option key={name}>{name}</option>)}</select><button disabled={busy} className="bg-emerald-500 px-3 text-sm font-semibold text-zinc-950">{busy ? "Validating..." : "Preview CSV"}</button></form>
    {message && <p role="status" className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{message}</p>}
    {preview && <div className="mt-4 grid gap-4 md:grid-cols-3"><div><b>Latest preview</b><p className="text-sm">Accepted {preview.accepted} - Rejected {preview.rejected}</p><p className="text-sm">Duplicates {preview.duplicates.length} - Review {preview.reviews.length}</p></div><div className="text-xs"><b>Row errors</b>{preview.errors.map((error) => <p key={error.row}>Row {error.row}: {error.message}</p>)}{preview.duplicates.map((id) => <p key={id}>Duplicate order: {id}</p>)}</div><div className="text-xs"><b>Unmatched preview</b>{preview.reviews.map((review) => <p key={review.id}>{review.externalOrderId} - {review.itemTitle} - SKU {review.externalSku || "none"} - {Math.round(review.matchConfidence * 100)}% match</p>)}{!preview.reviews.length && <p>All item lines matched.</p>}</div></div>}
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]"><div className="border border-border"><div className="border-b border-border p-3 text-sm font-semibold">Import batch history</div>{batches.map((batch) => <button type="button" key={batch.id} onClick={() => setActiveBatchId(batch.id)} className={`block w-full border-b border-border p-3 text-left text-xs ${activeBatch?.id === batch.id ? "bg-muted/40" : ""}`}><b>{batch.filename}</b><span className="ml-2 text-emerald-300">{batch.status}</span><p>Accepted {batch.acceptedRows} - Rejected {batch.rejectedRows} - Unresolved {batch.unresolvedRows} - Failed {batch.failedRows} - Imported {batch.importedOrders}</p></button>)}{!batches.length && <p className="p-4 text-sm text-muted-foreground">No import batches yet.</p>}</div>
      <div className="border border-border"><div className="flex flex-wrap items-center gap-2 border-b border-border p-3"><b className="mr-auto text-sm">Batch detail</b>{activeBatch && <><button className="border px-2 py-1 text-xs" onClick={() => batchAction("confirm")}>Confirm</button><button className="border px-2 py-1 text-xs" onClick={() => batchAction("retry")}>Retry failed rows</button><button className="border px-2 py-1 text-xs" onClick={() => batchAction("reopen")}>Reopen review</button><button className="border px-2 py-1 text-xs" onClick={() => batchAction("archive")}>Archive</button><button className="border px-2 py-1 text-xs" onClick={() => setMessage(`row,error\n${activeBatch.rows.filter((row) => row.error).map((row) => `${row.rowNumber},"${row.error}"`).join("\n") || "none,none"}`)}>Download error report</button></>}</div>{activeBatch ? <div className="max-h-[460px] overflow-auto divide-y divide-border">{activeBatch.rows.map((row) => { const review = reviews.find((item) => item.id === row.reviewId); return <div className="grid gap-3 p-3 text-xs md:grid-cols-[1fr_auto]" key={row.id}><div><b>Row {row.rowNumber}: {row.externalOrderId}</b><span className="ml-2 text-emerald-300">{row.status}</span><p className="mt-1 text-muted-foreground">{row.itemTitle} x{row.quantity} - SKU {row.externalSku || "none"} - listing {row.externalListingId || "none"}</p>{row.error && <p className="mt-1 text-red-300">{row.error}</p>}{row.orderId && <p className="mt-1 text-muted-foreground">Created order {row.orderId}</p>}{review && <p className="mt-1 text-muted-foreground">Confidence {Math.round(review.matchConfidence * 100)}% - {review.state}</p>}</div>{review && <div className="flex flex-wrap gap-2">{data.variants[0] && <button className="border px-2 py-1" onClick={() => resolve(review.id, "link_variant", data.variants[0].id)}>Link variant</button>}<button className="border px-2 py-1" onClick={() => resolve(review.id, "create_variant")}>Create product/variant</button><button className="border px-2 py-1" onClick={() => resolve(review.id, "non_inventory")}>Non-inventory</button><button className="border px-2 py-1" onClick={() => resolve(review.id, "ignore")}>Ignore row</button><button className="border px-2 py-1" onClick={() => resolve(review.id, "cancel")}>Cancel row</button><button className="border px-2 py-1" onClick={() => resolve(review.id, "reopen")}>Reopen</button></div>}</div>; })}</div> : <p className="p-4 text-sm text-muted-foreground">Select an import batch.</p>}</div></div></section>;
}
