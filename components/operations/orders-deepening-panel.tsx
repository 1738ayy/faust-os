"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Notice, Order, OrderStatus, SavedOrderView, Variant } from "@/domain/business";

const defaultViews = ["All Orders", "Needs Action", "Ship Today", "Unpaid", "Reservation Failed", "Negative Margin", "Returns Open", "Refund Review", "Import Review"];
const statuses: OrderStatus[] = ["pending_payment", "paid", "confirmed", "reserved", "ready_to_pack", "packed", "ready_to_ship", "shipped", "delivered", "cancelled", "return_requested", "returned", "refunded"];
const actionLabels: Record<string, string> = { reserve: "Reserve", release: "Release reservation", "ready-to-pack": "Ready to pack", packed: "Packed", "attach-preset": "Attach preset", "ready-to-ship": "Ready to ship", ship: "Ship", cancel: "Cancel", tag: "Add tag", export: "Export CSV" };
const field = "faust-field faust-focus px-3 py-2 text-sm";
const smallButton = "rounded-full border border-red-950/60 bg-zinc-950/50 px-3 py-1.5 text-xs font-medium transition hover:border-red-500/50 hover:text-white";
const primaryButton = "rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500";

function legalBulk(order: Order, action: string) {
  if (action === "reserve") return ["paid", "confirmed"].includes(order.status);
  if (action === "release" || action === "cancel") return !["shipped", "delivered", "closed", "cancelled", "refunded"].includes(order.status);
  if (action === "ready-to-pack") return order.status === "reserved";
  if (action === "packed") return order.status === "ready_to_pack";
  if (action === "attach-preset") return order.status === "packed";
  if (action === "ready-to-ship") return order.status === "label_purchased" || order.trackingNumber;
  if (action === "ship") return order.status === "ready_to_ship";
  return true;
}

export function OrdersDeepeningPanel({ orders, variants, savedViews = [], notices = [] }: { orders: Order[]; variants: Variant[]; savedViews?: SavedOrderView[]; notices?: Notice[] }) {
  const router = useRouter();
  const [view, setView] = useState(savedViews.find((entry) => entry.isDefault)?.name || "All Orders");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [marketplace, setMarketplace] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("reserve");
  const [message, setMessage] = useState("");
  const views: SavedOrderView[] = savedViews.length ? savedViews : defaultViews.map((name, position) => ({ id: name, name, filters: {}, isDefault: position === 0, position, createdAt: "" }));
  const shown = useMemo(() => orders.filter((order) => {
    const search = `${order.number} ${order.marketplace} ${order.items.map((item) => item.title).join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const viewMatch = view === "All Orders" || view === "Needs Action" && ["pending_payment", "paid", "confirmed", "reserved", "ready_to_pack", "packed", "ready_to_ship"].includes(order.status) || view === "Unpaid" && order.status === "pending_payment" || view === "Returns Open" && order.status.includes("return") || view === "Refund Review" && (order.refunds || []).length > 0 || view === "Import Review" && order.notes?.includes("Imported from") || !defaultViews.includes(view);
    return search && viewMatch && (!status || order.status === status) && (!marketplace || order.marketplace === marketplace);
  }), [orders, query, view, status, marketplace]);
  const selectedOrders = orders.filter((order) => selected.includes(order.id));
  const eligible = selectedOrders.filter((order) => legalBulk(order, bulkAction));
  const ineligible = selectedOrders.filter((order) => !legalBulk(order, bulkAction));

  async function request(endpoint: string, body: Record<string, unknown>) {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Request failed.");
    router.refresh();
    return data;
  }
  async function action(orderId: string, actionName: string, extra: Record<string, unknown> = {}) {
    try { await request(`/api/orders/${orderId}/actions`, { action: actionName, ...extra }); setMessage("Order saved; timelines, inventory, finance, and activity refreshed."); } catch (error) { setMessage(error instanceof Error ? error.message : "Order action failed."); }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await request("/api/orders", { marketplace: form.get("marketplace"), customer: { name: form.get("customer"), email: form.get("email") || undefined }, items: [{ variantId: form.get("variantId"), quantity: Number(form.get("quantity")), unitSellingPrice: Number(form.get("price")) }], shippingCharged: 0, shippingCost: 0 }); setMessage("Manual order created."); event.currentTarget.reset(); } catch (error) { setMessage(error instanceof Error ? error.message : "Order creation failed."); }
  }
  async function saveView(actionName: string, id?: string) {
    try { await request("/api/orders/saved-views", { action: actionName, id, name: `${view} custom`, query, status: status || undefined, marketplace: marketplace || undefined, isDefault: actionName === "create" }); setMessage(`Saved view ${actionName} complete.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Saved view failed."); }
  }
  async function runBulk() {
    if (!selected.length) return setMessage("Select at least one order.");
    if (bulkAction === "export") { const rows = selectedOrders.map((order) => `${order.number},${order.marketplace},${order.status}`).join("\n"); setMessage(`CSV export ready:\norder,marketplace,status\n${rows}`); return; }
    try { const result = await request("/api/orders/bulk", { action: bulkAction, orderIds: eligible.map((order) => order.id), tag: "bulk-review", reason: "Bulk order action" }); setMessage(`${actionLabels[bulkAction]} finished: ${result.results.filter((entry: { ok: boolean }) => entry.ok).length}/${selected.length} eligible succeeded. ${ineligible.length} blocked.`); setSelected([]); } catch (error) { setMessage(error instanceof Error ? error.message : "Bulk action failed."); }
  }
  async function updateNotice(id: string, actionName: string) {
    try { await request("/api/orders/notifications", { id, action: actionName }); setMessage(`Notification ${actionName}.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Notification action failed."); }
  }

  return <section className="space-y-5"><div className="faust-surface p-5"><p className="text-sm font-medium text-red-200">Order intake</p><h2 className="mt-2 text-2xl font-semibold">Add or review orders</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Create a manual order, reserve inventory, and move paid orders toward packing without exposing the technical machinery underneath.</p><form onSubmit={create} className="mt-5 grid gap-3 md:grid-cols-5"><input required name="customer" className={field} placeholder="Customer name" /><input name="email" className={field} placeholder="Customer email" /><select required name="marketplace" className={field}><option>Depop</option><option>eBay</option><option>Etsy</option><option>Mercari</option><option>Poshmark</option><option>Manual</option></select><select required name="variantId" className={field}>{variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.sku} - {variant.title}</option>)}</select><div className="flex gap-2"><input required name="quantity" type="number" min="1" defaultValue="1" className={`${field} w-20`} /><input required name="price" type="number" min="0" step="0.01" placeholder="Price" className={`${field} w-24`} /><button className={primaryButton}>Create order</button></div></form></div>
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><div className="faust-surface p-4"><div className="flex flex-wrap gap-2">{views.sort((a, b) => (a.position || 0) - (b.position || 0)).map((item) => <button type="button" key={item.id} onClick={() => setView(item.name)} className={`${smallButton} ${view === item.name ? "border-red-500/50 bg-red-500/10 text-red-100" : ""}`}>{item.name}{item.isDefault ? " *" : ""}</button>)}</div><div className="mt-4 grid gap-3 md:grid-cols-3"><input value={query} onChange={(event) => setQuery(event.target.value)} className={field} placeholder="Search orders" /><select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | "")} className={field}><option value="">Any status</option>{statuses.map((name) => <option value={name} key={name}>{name.replaceAll("_", " ")}</option>)}</select><select value={marketplace} onChange={(event) => setMarketplace(event.target.value)} className={field}><option value="">Any marketplace</option>{["Depop","eBay","Etsy","Mercari","Poshmark","Manual"].map((name) => <option key={name}>{name}</option>)}</select></div><div className="mt-4 flex flex-wrap gap-2"><button className={smallButton} onClick={() => saveView("create")}>Save this view</button>{savedViews.find((item) => item.name === view) && <><button className={smallButton} onClick={() => saveView("update", savedViews.find((item) => item.name === view)?.id)}>Update filters</button><button className={smallButton} onClick={() => saveView("duplicate", savedViews.find((item) => item.name === view)?.id)}>Duplicate</button><button className={smallButton} onClick={() => saveView("default", savedViews.find((item) => item.name === view)?.id)}>Set default</button><button className={smallButton} onClick={() => saveView("delete", savedViews.find((item) => item.name === view)?.id)}>Delete</button></>}</div></div>
      <div className="faust-surface p-4"><h2 className="font-semibold">Order alerts</h2><p className="mt-1 text-sm text-muted-foreground">Problems that need review before an order can keep moving.</p><div className="mt-4 space-y-3">{notices.filter((notice) => notice.category === "orders" && !notice.archived).slice(0, 5).map((notice) => <div className="faust-card p-3 text-xs" key={notice.id}><div className="flex justify-between gap-3"><b>{notice.title}</b><span className="rounded-full border border-red-950/45 bg-black/35 px-2 py-0.5">{notice.resolved ? "resolved" : notice.read ? "read" : "unread"}</span></div><p className="mt-2 leading-5 text-muted-foreground">{notice.detail}</p><div className="mt-3 flex flex-wrap gap-2"><button className={smallButton} onClick={() => updateNotice(notice.id, notice.read ? "unread" : "read")}>{notice.read ? "Mark unread" : "Mark read"}</button><button className={smallButton} onClick={() => updateNotice(notice.id, notice.resolved ? "reopen" : "resolve")}>{notice.resolved ? "Reopen" : "Resolve"}</button><button className={smallButton} onClick={() => updateNotice(notice.id, "archive")}>Archive</button></div></div>)}{!notices.filter((notice) => notice.category === "orders" && !notice.archived).length && <p className="text-sm text-muted-foreground">Nothing needs review right now. New marketplace order issues will appear here.</p>}</div></div></div>
    <div className="faust-surface p-4"><div className="flex flex-wrap items-center gap-3"><b className="mr-auto text-sm">{selected.length} selected</b><select value={bulkAction} onChange={(event) => setBulkAction(event.target.value)} className={`${field} text-xs`}>{Object.keys(actionLabels).map((name) => <option value={name} key={name}>{actionLabels[name]}</option>)}</select><button onClick={runBulk} className={primaryButton}>Apply to eligible orders</button></div>{selected.length > 0 && <div className="mt-4 grid gap-3 text-sm md:grid-cols-2"><div className="faust-card p-3"><b>Can run ({eligible.length})</b>{eligible.map((order) => <p className="mt-1 text-muted-foreground" key={order.id}>{order.number}</p>)}</div><div className="faust-card p-3"><b>Blocked ({ineligible.length})</b>{ineligible.map((order) => <p className="mt-1 text-muted-foreground" key={order.id}>{order.number}: status {order.status.replaceAll("_", " ")}</p>)}</div></div>}</div>
    <div className="faust-surface divide-y divide-red-950/35 overflow-hidden">{shown.map((order) => <article key={order.id} className="grid gap-4 p-4 lg:grid-cols-[auto_1fr_auto]"><input aria-label={`Select ${order.number}`} type="checkbox" checked={selected.includes(order.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} /><div><b className="text-base">{order.number}</b><span className="ml-2 rounded-full border border-red-950/45 bg-red-500/10 px-2.5 py-1 text-xs text-red-100">{order.status.replaceAll("_", " ")}</span><p className="mt-2 text-sm text-muted-foreground">{order.marketplace} · {order.items.length} line item(s) · {order.items.map((item) => `${item.title} x${item.quantity}`).join(", ")}</p>{order.tags?.length ? <p className="mt-2 text-xs text-muted-foreground">Tags: {order.tags.join(", ")}</p> : null}</div><div className="flex flex-wrap items-start gap-2">{order.status === "paid" || order.status === "confirmed" ? <button onClick={() => action(order.id, "reserve")} className={smallButton}>Reserve inventory</button> : null}{order.status === "reserved" ? <button onClick={() => action(order.id, "ready-to-pack")} className={smallButton}>Ready to pack</button> : null}{order.status === "ready_to_pack" ? <button onClick={() => action(order.id, "packed")} className={smallButton}>Mark packed</button> : null}{order.status === "packed" ? <button onClick={() => action(order.id, "attach-label", { trackingNumber: `MANUAL-${order.number}` })} className={smallButton}>Attach label</button> : null}{order.status === "ready_to_ship" ? <button onClick={() => action(order.id, "ship")} className={smallButton}>Ship</button> : null}<button onClick={() => action(order.id, "cancel", { reason: "Manual cancellation" })} className={smallButton}>Cancel</button></div></article>)}{!shown.length && <p className="p-6 text-sm text-muted-foreground">No orders match this view. Marketplace orders that need processing will appear here.</p>}</div>{message && <p role="status" className="faust-card whitespace-pre-wrap p-4 text-sm text-muted-foreground">{message}</p>}</section>;
}
