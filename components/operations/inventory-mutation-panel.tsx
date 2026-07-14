"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Location, StockBalance } from "@/domain/business";

type Action = "adjust" | "transfer" | "count" | "damage" | "quarantine" | "release_quarantine" | "lost" | "found" | "location";
const actions: { id: Action; label: string; description: string }[] = [
  { id: "adjust", label: "Adjust stock", description: "Record an explicit positive or negative correction." },
  { id: "transfer", label: "Transfer", description: "Move available units between two locations." },
  { id: "count", label: "Cycle count", description: "Reconcile a physical count without violating reservations." },
  { id: "damage", label: "Mark damaged", description: "Remove usable units for a documented damage event." },
  { id: "quarantine", label: "Move to quarantine", description: "Hold units out of availability for inspection." },
  { id: "release_quarantine", label: "Release quarantine", description: "Return inspected units to usable availability." },
  { id: "lost", label: "Mark lost", description: "Remove missing usable units from on-hand inventory." },
  { id: "found", label: "Record found", description: "Add recovered units through an auditable movement." },
  { id: "location", label: "Assign location", description: "Assign currently unlocated stock to a bin." },
];

export function InventoryMutationPanel({ balances, locations }: { balances: StockBalance[]; locations: Location[] }) {
  const [action, setAction] = useState<Action>("adjust");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const label = (balance: StockBalance) => `${locations.find((location) => location.id === balance.locationId)?.label || "Unassigned"} · ${balance.variantId.slice(0, 8)} · ${balance.onHand} on hand`;
  const selected = actions.find((entry) => entry.id === action)!;
  const requiresQuantity = action !== "location";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); const form = new FormData(event.currentTarget);
    if (form.get("confirm") !== "on") { setMessage("Confirm this inventory mutation before saving."); return; }
    const quantity = Number(form.get("quantity")); const reason = String(form.get("reason") || ""); const notes = String(form.get("notes") || ""); const relatedEntityId = String(form.get("relatedEntityId") || "") || undefined;
    const idempotencyKey = crypto.randomUUID();
    const endpoint = action === "adjust" ? "/api/inventory/adjust" : action === "transfer" ? "/api/inventory/transfer" : action === "count" ? "/api/inventory/cycle-count" : action === "location" ? "/api/inventory/location" : "/api/inventory/damage";
    const body = action === "adjust" ? { balanceId: form.get("balanceId"), quantity, reason, notes, relatedEntityId, idempotencyKey }
      : action === "transfer" ? { sourceBalanceId: form.get("sourceBalanceId"), destinationBalanceId: form.get("destinationBalanceId"), quantity, notes: [reason, notes].filter(Boolean).join(" — "), idempotencyKey }
      : action === "count" ? { balanceId: form.get("balanceId"), countedQuantity: quantity, idempotencyKey }
      : action === "location" ? { balanceId: form.get("balanceId"), locationId: form.get("locationId"), reason, notes, idempotencyKey }
      : { balanceId: form.get("balanceId"), quantity, action, reason, notes, relatedEntityId, idempotencyKey };
    setSubmitting(true);
    try { const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) { setMessage(result.message || "Mutation failed. No inventory was changed."); return; } setMessage("Saved. Balances, movement history, and activity history have refreshed."); router.refresh(); event.currentTarget.reset(); }
    catch { setMessage("The request could not be completed. No inventory was changed."); }
    finally { setSubmitting(false); }
  }
  return <section className="border border-border bg-card p-5" aria-label="Inventory actions">
    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inventory actions</p><h2 className="mt-1 text-lg font-semibold">{selected.label}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.description}</p></div>
    <div className="mt-4 flex flex-wrap gap-2">{actions.map((entry) => <button key={entry.id} type="button" className={`border px-3 py-2 text-xs ${action === entry.id ? "border-emerald-400 bg-emerald-400/10" : "border-border"}`} onClick={() => { setAction(entry.id); setMessage(""); }}>{entry.label}</button>)}</div>
    <form className="mt-5 grid gap-3 md:grid-cols-3" onSubmit={submit}>
      {action === "transfer" ? <><label className="grid gap-1 text-xs">Source balance<select required name="sourceBalanceId" className="border bg-background p-2">{balances.map((balance) => <option key={balance.id} value={balance.id}>{label(balance)}</option>)}</select></label><label className="grid gap-1 text-xs">Destination balance<select required name="destinationBalanceId" className="border bg-background p-2">{balances.map((balance) => <option key={balance.id} value={balance.id}>{label(balance)}</option>)}</select></label></> : <label className="grid gap-1 text-xs">Inventory balance<select required name="balanceId" className="border bg-background p-2">{balances.map((balance) => <option key={balance.id} value={balance.id}>{label(balance)}</option>)}</select></label>}
      {action === "location" ? <label className="grid gap-1 text-xs">Destination location<select required name="locationId" className="border bg-background p-2">{locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</select></label> : <label className="grid gap-1 text-xs">{action === "count" ? "Physical count" : action === "adjust" ? "Quantity delta" : "Quantity"}<input required name="quantity" type="number" step="1" min={action === "adjust" ? undefined : "1"} className="border bg-background p-2" placeholder={action === "adjust" ? "Example: -2" : "Whole units"} /></label>}
      {(action !== "count") && <label className="grid gap-1 text-xs">Reason<input required name="reason" className="border bg-background p-2" placeholder="What happened?" /></label>}
      {(action === "damage" || action === "quarantine" || action === "release_quarantine" || action === "lost" || action === "found" || action === "adjust") && <label className="grid gap-1 text-xs">Related order / supplier / receipt ID (optional)<input name="relatedEntityId" className="border bg-background p-2" placeholder="UUID if linked" /></label>}
      <label className="grid gap-1 text-xs md:col-span-2">Notes (optional)<input name="notes" className="border bg-background p-2" placeholder="Inspection, supplier issue, or receiving note" /></label>
      <label className="flex items-center gap-2 text-xs md:col-span-2"><input required name="confirm" type="checkbox" />I confirm this is the intended inventory movement.</label>
      <button disabled={submitting || (requiresQuantity && !balances.length)} className="bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">{submitting ? "Saving…" : `Confirm ${selected.label}`}</button>
    </form>
    {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
  </section>;
}
