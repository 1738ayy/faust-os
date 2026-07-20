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

const field = "faust-field faust-focus px-3 py-2 text-sm";
const actionButton = "rounded-full border border-sky-950/60 bg-zinc-950/50 px-3 py-2 text-xs font-medium transition hover:border-sky-400/50 hover:text-white";

export function InventoryMutationPanel({ balances, locations }: { balances: StockBalance[]; locations: Location[] }) {
  const [action, setAction] = useState<Action>("adjust");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const label = (balance: StockBalance) => `${locations.find((location) => location.id === balance.locationId)?.label || "Unassigned"} · ${balance.variantId.slice(0, 8)} · ${balance.onHand} on hand`;
  const selected = actions.find((entry) => entry.id === action)!;
  const requiresQuantity = action !== "location";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    const form = new FormData(formElement);
    if (form.get("confirm") !== "on") { setMessage("Confirm this inventory movement before saving."); return; }
    const quantity = Number(form.get("quantity"));
    const reason = String(form.get("reason") || "");
    const notes = String(form.get("notes") || "");
    const relatedEntityId = String(form.get("relatedEntityId") || "") || undefined;
    const idempotencyKey = crypto.randomUUID();
    const endpoint = action === "adjust" ? "/api/inventory/adjust" : action === "transfer" ? "/api/inventory/transfer" : action === "count" ? "/api/inventory/cycle-count" : action === "location" ? "/api/inventory/location" : "/api/inventory/damage";
    const body = action === "adjust" ? { balanceId: form.get("balanceId"), quantity, reason, notes, relatedEntityId, idempotencyKey }
      : action === "transfer" ? { sourceBalanceId: form.get("sourceBalanceId"), destinationBalanceId: form.get("destinationBalanceId"), quantity, notes: [reason, notes].filter(Boolean).join(" — "), idempotencyKey }
      : action === "count" ? { balanceId: form.get("balanceId"), countedQuantity: quantity, idempotencyKey }
      : action === "location" ? { balanceId: form.get("balanceId"), locationId: form.get("locationId"), reason, notes, idempotencyKey }
      : { balanceId: form.get("balanceId"), quantity, action, reason, notes, relatedEntityId, idempotencyKey };
    setSubmitting(true);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message || "Inventory was not changed."); return; }
      setMessage("Saved. Balances, movement history, and activity history have refreshed.");
      router.refresh();
      formElement.reset();
    } catch {
      setMessage("The request could not be completed. No inventory was changed.");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="rounded-3xl border border-sky-950/45 bg-zinc-950/55 p-5 shadow-lg shadow-black/20 backdrop-blur" aria-label="Inventory actions">
    <div><p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-200">Inventory action</p><h2 className="mt-2 text-xl font-semibold">{selected.label}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{selected.description}</p></div>
    <div className="mt-5 flex flex-wrap gap-2">{actions.map((entry) => <button key={entry.id} type="button" className={`${actionButton} ${action === entry.id ? "border-sky-400/50 bg-sky-400/10 text-sky-50" : ""}`} onClick={() => { setAction(entry.id); setMessage(""); }}>{entry.label}</button>)}</div>
    <form className="mt-5 grid gap-3 md:grid-cols-3" onSubmit={submit}>
      {action === "transfer" ? <><label className="grid gap-1 text-sm">Source balance<select required name="sourceBalanceId" className={field}>{balances.map((balance) => <option key={balance.id} value={balance.id}>{label(balance)}</option>)}</select></label><label className="grid gap-1 text-sm">Destination balance<select required name="destinationBalanceId" className={field}>{balances.map((balance) => <option key={balance.id} value={balance.id}>{label(balance)}</option>)}</select></label></> : <label className="grid gap-1 text-sm">Inventory balance<select required name="balanceId" className={field}>{balances.map((balance) => <option key={balance.id} value={balance.id}>{label(balance)}</option>)}</select></label>}
      {action === "location" ? <label className="grid gap-1 text-sm">Destination location<select required name="locationId" className={field}>{locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</select></label> : <label className="grid gap-1 text-sm">{action === "count" ? "Physical count" : action === "adjust" ? "Quantity delta" : "Quantity"}<input required name="quantity" type="number" step="1" min={action === "adjust" ? undefined : "1"} className={field} placeholder={action === "adjust" ? "Example: -2" : "Whole units"} /></label>}
      {(action !== "count") && <label className="grid gap-1 text-sm">Reason<input required name="reason" className={field} placeholder="What happened?" /></label>}
      {(action === "damage" || action === "quarantine" || action === "release_quarantine" || action === "lost" || action === "found" || action === "adjust") && <label className="grid gap-1 text-sm">Related order / supplier / receipt ID (optional)<input name="relatedEntityId" className={field} placeholder="UUID if linked" /></label>}
      <label className="grid gap-1 text-sm md:col-span-2">Notes (optional)<input name="notes" className={field} placeholder="Inspection, supplier issue, or receiving note" /></label>
      <label className="flex items-center gap-2 text-sm md:col-span-2"><input required name="confirm" type="checkbox" />I confirm this is the intended inventory movement.</label>
      <button disabled={submitting || (requiresQuantity && !balances.length)} className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:opacity-50">{submitting ? "Saving…" : `Confirm ${selected.label}`}</button>
    </form>
    {message && <p role="status" className="mt-4 rounded-2xl border border-sky-950/35 bg-black/35 p-3 text-sm text-muted-foreground">{message}</p>}
  </section>;
}
