"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OperatingData } from "@/domain/business";
import { buildFinanceModel } from "@/lib/finance";

const input = "faust-field faust-focus mt-1 w-full px-3 py-2 text-sm";
const button = "rounded-full border border-red-950/60 bg-zinc-950/50 px-3 py-1.5 text-xs font-medium transition hover:border-red-500/50 hover:text-white disabled:opacity-50";

function idempotencyKey() {
  return crypto.randomUUID();
}

export function FinanceActionsPanel({ data }: { data: OperatingData }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const finance = buildFinanceModel(data);
  const expense = finance.expenses.find((entry) => !entry.archivedAt && !entry.deletedAt) || finance.expenses[0];
  const payout = finance.payouts.find((entry) => entry.status !== "archived") || finance.payouts[0];
  const budget = finance.budgets[0];
  const allocation = finance.allocations[0];
  const firstOrder = data.orders[0];
  const supplier = data.suppliers[0];

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action); setMessage("");
    try {
      const response = await fetch("/api/finance/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, idempotencyKey: idempotencyKey(), ...payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Finance action failed.");
      setMessage(`Finance ${action.replaceAll("-", " ")} saved.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Finance action failed.");
    } finally {
      setBusy("");
    }
  }

  async function submit(form: HTMLFormElement) {
    const fields = new FormData(form);
    const action = String(fields.get("action"));
    const payload: Record<string, unknown> = {};
    fields.forEach((value, key) => { if (key !== "action" && value !== "") payload[key] = typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value; });
    await run(action, payload);
  }

  return <section aria-label="Finance workflows" className="faust-surface overflow-hidden">
    <h2 className="border-b border-red-950/45 px-5 py-4 font-semibold">Finance Workflows</h2>
    <div className="grid gap-5 p-5 lg:grid-cols-2">
      <form className="faust-card p-4" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
        <h3 className="font-semibold">Expenses</h3>
        <input type="hidden" name="action" value="create-expense" />
        <label className="mt-3 block text-xs">Vendor<input className={input} name="vendor" defaultValue="QuickBooks import" /></label>
        <label className="mt-3 block text-xs">Category<input className={input} name="category" defaultValue="Software" /></label>
        <label className="mt-3 block text-xs">Amount<input className={input} name="amount" defaultValue="29" /></label>
        <label className="mt-3 block text-xs">Recurring<select className={input} name="recurring" defaultValue="monthly"><option value="none">None</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>
        <label className="mt-3 block text-xs">Receipt boundary<select className={input} name="receiptStatus" defaultValue="pending_attachment"><option value="not_required">Not required</option><option value="pending_attachment">Pending attachment</option><option value="attached">Attached</option></select></label>
        <input type="hidden" name="supplierId" value={supplier?.id || ""} /><input type="hidden" name="orderId" value={firstOrder?.id || ""} />
        <button className={`${button} mt-4`} disabled={busy === "create-expense"}>Create expense</button>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => expense && run("edit-expense", { id: expense.id, vendor: "Edited vendor", category: expense.category, amount: expense.amount + 1, recurring: expense.recurring, receiptStatus: "attached", notes: "Edited from workflow" })}>Edit expense</button><button type="button" className={button} onClick={() => expense && run("duplicate-expense", { id: expense.id })}>Duplicate expense</button><button type="button" className={button} onClick={() => expense && run("archive-expense", { id: expense.id, notes: "Archive workflow" })}>Archive expense</button><button type="button" className={button} onClick={() => expense && run("delete-expense", { id: expense.id, notes: "Delete workflow" })}>Delete expense</button></div>
      </form>
      <form className="faust-card p-4" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
        <h3 className="font-semibold">Payouts</h3>
        <input type="hidden" name="action" value="reconcile-payout" />
        <label className="mt-3 block text-xs">Marketplace<select className={input} name="marketplace" defaultValue="Depop"><option>Depop</option><option>eBay</option><option>Etsy</option><option>Mercari</option><option>Poshmark</option><option>Manual</option></select></label>
        <label className="mt-3 block text-xs">Expected amount<input className={input} name="expectedAmount" defaultValue={finance.overview.pendingPayouts || 81.18} /></label>
        <label className="mt-3 block text-xs">Actual amount<input className={input} name="actualAmount" defaultValue={finance.overview.pendingPayouts || 81.18} /></label>
        <label className="mt-3 block text-xs">External payout ID<input className={input} name="externalPayoutId" defaultValue="DEPOP-PAYOUT-MANUAL" /></label>
        <button className={`${button} mt-4`}>Reconcile payout</button>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => run("import-payout", { marketplace: "Depop", expectedAmount: 81.18, actualAmount: 80, externalPayoutId: "CSV-PAYOUT-1", notes: "Imported CSV payout" })}>Import payout</button><button type="button" className={button} onClick={() => payout && run("resolve-payout", { id: payout.id, resolution: "Resolved as marketplace adjustment" })}>Resolve discrepancy</button><button type="button" className={button} onClick={() => payout && run("reopen-payout", { id: payout.id, resolution: "Reopened for review" })}>Reopen reconciliation</button><button type="button" className={button} onClick={() => payout && run("archive-payout", { id: payout.id })}>Archive payout</button></div>
      </form>
      <form className="faust-card p-4" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
        <h3 className="font-semibold">Budgets</h3>
        <input type="hidden" name="action" value="create-budget" />
        <label className="mt-3 block text-xs">Month<input className={input} name="month" defaultValue={new Date().toISOString().slice(0, 7)} /></label>
        <label className="mt-3 block text-xs">Category<input className={input} name="category" defaultValue="Advertising" /></label>
        <label className="mt-3 block text-xs">Amount<input className={input} name="amount" defaultValue="200" /></label>
        <button className={`${button} mt-4`}>Create budget</button>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => budget && run("edit-budget", { id: budget.id, category: budget.category, amount: budget.amount + 25, actualAmount: budget.actualAmount })}>Edit budget</button><button type="button" className={button} onClick={() => budget && run("duplicate-budget", { id: budget.id })}>Duplicate budget</button><button type="button" className={button} onClick={() => budget && run("rollover-budget", { id: budget.id, month: "2026-08" })}>Monthly rollover</button><button type="button" className={button} onClick={() => run("yearly-template", { category: "Shipping expense", amount: 1200, templateName: "Annual shipping reserve" })}>Yearly template</button></div>
      </form>
      <div className="faust-card p-4">
        <h3 className="font-semibold">Tax Reserve</h3>
        <div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={() => run("reserve-tax", { amount: 25, basisAmount: 140, rate: 0.18, notes: "Reserve from monthly profit" })}>Reserve movement</button><button className={button} onClick={() => run("release-tax", { amount: 10, basisAmount: 10, rate: 1, notes: "Release over-reserve" })}>Release</button><button className={button} onClick={() => run("adjust-tax", { amount: 5, basisAmount: 5, rate: 1, notes: "Quarterly adjustment" })}>Adjustment</button></div>
      </div>
      <div className="faust-card p-4">
        <h3 className="font-semibold">Reinvestment</h3>
        <p className="mt-2 text-xs text-muted-foreground">Current allocation: {allocation?.target.replaceAll("_", " ")} {allocation?.percentage}%</p>
        <div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={() => run("edit-allocation", { target: "inventory", percentage: 50 })}>Edit allocation</button><button className={button} onClick={() => run("simulate-allocation", { target: "marketing", percentage: 12 })}>Simulate allocation</button><button className={button} onClick={() => run("approve-allocation", { target: "inventory", percentage: 50 })}>Approve allocation</button></div>
      </div>
      <div className="faust-card p-4">
        <h3 className="font-semibold">Forecast Scenarios</h3>
        <div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={() => run("configure-forecast", { scenario: "expected", revenueMultiplier: 1.08, expenseMultiplier: 1.02, assumption: "Edited scenario from Finance workflow" })}>Configure forecast</button></div>
      </div>
    </div>
    {message && <p role="status" className="border-t border-red-950/45 px-5 py-3 text-sm text-red-200">{message}</p>}
  </section>;
}
