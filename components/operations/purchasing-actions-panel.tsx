"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OperatingData } from "@/domain/business";

const button = "rounded-full border border-red-950/60 bg-zinc-950/50 px-3 py-1.5 text-xs font-medium transition hover:border-red-500/50 hover:text-white disabled:opacity-50";

export function PurchasingActionsPanel({ data }: { data: OperatingData }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const supplier = data.suppliers[0];
  const variant = data.variants[0];
  const po = data.purchaseOrders[0];
  const receivablePo = data.purchaseOrders.find((entry) => entry.items.some((item) => item.receivedQuantity < item.expectedQuantity)) || po;

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action); setMessage("");
    try {
      const response = await fetch("/api/purchasing/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, idempotencyKey: crypto.randomUUID(), ...payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Purchasing action failed.");
      setMessage(`Purchasing ${action.replaceAll("-", " ")} saved.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchasing action failed.");
    } finally {
      setBusy("");
    }
  }

  return <section aria-label="Purchasing workflows" className="faust-surface overflow-hidden">
    <h2 className="border-b border-red-950/45 px-5 py-4 font-semibold">Purchasing Workflows</h2>
    <div className="grid gap-4 p-5 lg:grid-cols-2">
      <div className="faust-card p-4"><h3 className="font-semibold">1688 Purchase Order</h3><p className="mt-2 text-xs text-muted-foreground">Creates PO approval, RMB/USD cost basis, freight consolidation, price history, and Finance commitment.</p><button className={`${button} mt-4`} disabled={!supplier || !variant || busy === "create-1688-po"} onClick={() => supplier && variant && run("create-1688-po", { supplierId: supplier.id, reference: `1688-${Date.now().toString().slice(-5)}`, currency: "RMB", exchangeRate: 0.14, items: [{ variantId: variant.id, expectedQuantity: 6, unitCost: 118 }], domesticFreight: 48, internationalFreight: 32, duties: 8, customs: 4 })}>Create 1688 PO</button></div>
      <div className="faust-card p-4"><h3 className="font-semibold">Approvals & payments</h3><div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={!po} onClick={() => po && run("approve-po", { purchaseOrderId: po.id, approved: true, reason: "Approved for reorder" })}>Approve PO</button><button className={button} disabled={!po} onClick={() => po && run("record-payment", { purchaseOrderId: po.id, type: "deposit", currency: "RMB", amountOriginal: 300, exchangeRate: 0.14 })}>Record deposit</button><button className={button} disabled={!po} onClick={() => po && run("record-payment", { purchaseOrderId: po.id, type: "final", currency: "RMB", amountOriginal: 420, exchangeRate: 0.14 })}>Record final payment</button><button className={button} disabled={!po} onClick={() => po && run("record-payment", { purchaseOrderId: po.id, type: "freight", currency: "USD", amountOriginal: 38, exchangeRate: 1 })}>Record freight</button></div></div>
      <div className="faust-card p-4"><h3 className="font-semibold">Parcel-to-lot receiving</h3><p className="mt-2 text-xs text-muted-foreground">Receives explicit PO rows, creates lots through Wholesale Core, and opens claims for shortages/damage/overage.</p><button className={`${button} mt-4`} disabled={!receivablePo} onClick={() => { const item = receivablePo?.items[0]; if (receivablePo && item) void run("receive-parcel-to-lots", { purchaseOrderId: receivablePo.id, parcelId: receivablePo.parcelId, rows: [{ purchaseOrderItemId: item.id, receivedQuantity: Math.max(1, item.expectedQuantity - item.receivedQuantity - 1), damagedQuantity: 1, notes: "One unit damaged during receiving" }] }); }}>Receive parcel rows</button></div>
      <div className="faust-card p-4"><h3 className="font-semibold">Reorder planning</h3><p className="mt-2 text-xs text-muted-foreground">Refreshes safety stock, reorder recommendations, estimated cost, and supplier links.</p><button className={`${button} mt-4`} onClick={() => run("generate-reorders")}>Generate reorder recommendations</button><button className={`${button} ml-2 mt-4`} onClick={() => run("seed-supplier-ops")}>Refresh supplier scorecards</button></div>
    </div>
    {message && <p role="status" className="border-t border-red-950/45 px-5 py-3 text-sm text-red-200">{message}</p>}
  </section>;
}
