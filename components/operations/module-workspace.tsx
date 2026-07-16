import Link from "next/link";
import { ArrowRight, PackagePlus } from "lucide-react";
import type { ReturnTypeSnapshot } from "@/components/operations/types";
import { OperationButton } from "@/components/operations/operation-button";
import { PurchasingActionsPanel } from "@/components/operations/purchasing-actions-panel";
import { money, orderProfit } from "@/lib/business-calculations";

type ModuleName = "inventory" | "orders" | "listings" | "sourcing" | "purchasing" | "shipping" | "finance" | "suppliers" | "customers" | "analytics" | "automations" | "ai" | "tasks";
const meta: Record<ModuleName, { title: string; description: string; action?: [string, string] }> = {
  inventory: { title: "Inventory", description: "Variant stock by location with immutable movement history.", action: ["Source product", "/sourcing"] },
  orders: { title: "Orders", description: "Multi-item orders, reservations, and fulfillment state.", action: ["Shipping queue", "/shipping"] },
  listings: { title: "Listings", description: "Marketplace-specific records with manual publishing fallback." },
  sourcing: { title: "Sourcing", description: "Import, analyze, and convert source products.", action: ["Opportunity Analyzer", "/opportunity-analyzer"] },
  purchasing: { title: "Purchasing & inbound", description: "1688 purchase orders, supplier performance, landed cost, receiving, and reorder planning." },
  shipping: { title: "Shipping & fulfillment", description: "Status-driven packing and dispatch queue." },
  finance: { title: "Finance", description: "Recorded transactions, order profitability, and cash." },
  suppliers: { title: "Suppliers", description: "Supplier relationships, scorecards, contacts, claims, and price history." },
  customers: { title: "Customers", description: "Customer history from recorded orders." },
  analytics: { title: "Analytics", description: "Derived performance views from operational records." },
  automations: { title: "Automations", description: "Deterministic rules with run history and safe manual fallback." },
  ai: { title: "AI Center", description: "Evidence-backed deterministic insights until an AI credential is connected." },
  tasks: { title: "Tasks", description: "Operating tasks linked to business records." },
};

export function ModuleWorkspace({ module, snapshot }: { module: ModuleName; snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  const info = meta[module];
  const empty = data.mode === "empty" && module !== "sourcing";
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">Operations workspace</p>
        <h1 className="mt-2 text-3xl font-semibold">{info.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{info.description}</p>
      </div>
      {info.action && <Link href={info.action[1]} className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950">{info.action[0]} <ArrowRight className="inline" size={14} /></Link>}
    </header>
    {empty ? <Empty /> : <Content module={module} snapshot={snapshot} />}
  </div>;
}

function Empty() {
  return <div className="border border-dashed border-border bg-card p-8 text-center">
    <PackagePlus className="mx-auto text-emerald-400" />
    <h2 className="mt-3 font-semibold">No records yet</h2>
    <p className="mt-2 text-sm text-muted-foreground">Load the development demo on Mission Control or create your first sourced product.</p>
    <Link href="/" className="mt-4 inline-block text-sm text-emerald-400">Go to Mission Control →</Link>
  </div>;
}

function Content({ module, snapshot }: { module: ModuleName; snapshot: ReturnTypeSnapshot }) {
  const { data, metrics } = snapshot;
  if (module === "inventory") return <Table headers={["SKU", "Location", "On hand", "Reserved", "Available", "Incoming", "Cost"]}>{data.variants.map((variant) => { const balance = data.balances.find((x) => x.variantId === variant.id); const location = data.locations.find((x) => x.id === balance?.locationId); const available = (balance?.onHand || 0) - (balance?.reserved || 0) - (balance?.damaged || 0) - (balance?.lost || 0) - (balance?.quarantined || 0); return <tr key={variant.id}><Cell primary={variant.sku} secondary={variant.title} /><td>{location?.label || "Unassigned"}</td><td>{balance?.onHand || 0}</td><td>{balance?.reserved || 0}</td><td>{available}</td><td>{balance?.incoming || 0}</td><td>{money(variant.landedUnitCost)}</td></tr>; })}</Table>;
  if (module === "orders") return <Table headers={["Order", "Customer", "Items", "Status", "Revenue", "Profit", "Action"]}>{data.orders.map((order) => { const profit = orderProfit(order, data.variants); return <tr key={order.id}><Cell primary={order.number} secondary={order.marketplace} /><td>{data.customers.find((x) => x.id === order.customerId)?.name || "Unmatched"}</td><td>{order.items.map((item) => `${item.title} ×${item.quantity}`).join(", ")}</td><td><Status value={order.status} /></td><td>{money(profit.revenue)}</td><td>{money(profit.netProfit)}</td><td>{order.status === "ready_to_ship" ? <OperationButton action="transition-order" id={order.id} status="shipped">Ship</OperationButton> : "—"}</td></tr>; })}</Table>;
  if (module === "listings") return <Table headers={["Listing", "Marketplace", "Price", "Quantity", "Status", "Manual fallback"]}>{data.listings.map((listing) => <tr key={listing.id}><Cell primary={listing.title} secondary={listing.marketplaceUrl || "External ID/URL not confirmed"} /><td>{listing.marketplace}</td><td>{money(listing.price)}</td><td>{listing.quantity}</td><td><Status value={listing.status} /></td><td>{listing.syncState === "manual" ? "Copy content, publish, paste URL, confirm active" : listing.syncState}</td></tr>)}</Table>;
  if (module === "sourcing") return <section className="border border-border bg-card p-6"><h2 className="font-semibold">Opportunity Analyzer</h2><p className="mt-2 text-sm text-muted-foreground">The extension import and card-based cost/profitability review are available in the analyzer.</p><Link className="mt-4 inline-block text-sm text-emerald-400" href="/opportunity-analyzer">Open analyzer →</Link></section>;
  if (module === "purchasing") return <PurchasingWorkspace snapshot={snapshot} />;
  if (module === "shipping") return <Table headers={["Order", "Items", "Status", "Tracking", "Ship by", "Action"]}>{data.orders.map((order) => <tr key={order.id}><Cell primary={order.number} secondary={order.marketplace} /><td>{order.items.map((x) => x.title).join(", ")}</td><td><Status value={order.status} /></td><td>{order.trackingNumber || "Attach tracking manually"}</td><td>{order.shipBy ? new Date(order.shipBy).toLocaleDateString() : "Not set"}</td><td>{order.status === "ready_to_ship" ? <OperationButton action="transition-order" id={order.id} status="shipped">Confirm dispatch</OperationButton> : "No action"}</td></tr>)}</Table>;
  if (module === "finance") return <Table headers={["Date", "Description", "Category", "Amount", "Status"]}>{data.transactions.map((item) => <tr key={item.id}><td>{new Date(item.occurredAt).toLocaleDateString()}</td><Cell primary={item.description} secondary={item.type} /><td>{item.category}</td><td className={item.amount >= 0 ? "text-emerald-300" : "text-red-300"}>{money(item.amount)}</td><td><Status value={item.status} /></td></tr>)}</Table>;
  if (module === "suppliers") return <SuppliersWorkspace snapshot={snapshot} />;
  if (module === "customers") return <Table headers={["Customer", "Location", "Orders", "Lifetime value", "Issues"]}>{data.customers.map((item) => <tr key={item.id}><Cell primary={item.name} secondary={item.email || "No email"} /><td>{[item.city, item.state].filter(Boolean).join(", ") || "Not set"}</td><td>{item.orderCount}</td><td>{money(item.lifetimeValue)}</td><td>{item.issueCount}</td></tr>)}</Table>;
  if (module === "analytics") return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric label="Gross revenue" value={money(metrics.revenue)} /><Metric label="Gross profit" value={money(metrics.grossProfit)} /><Metric label="Net profit" value={money(metrics.netProfit)} /><Metric label="Average order" value={money(metrics.averageOrderValue)} /></section>;
  if (module === "automations") return <section className="grid gap-4 md:grid-cols-2"><Rule title="Low-stock review" description="Creates a review task when available units reach the reorder point." /><Rule title="Late-shipment escalation" description="Creates a critical task when an unshipped order passes its ship-by date." /></section>;
  if (module === "ai") return <section className="grid gap-4 md:grid-cols-2">{data.insights.map((item) => <article className="border border-border bg-card p-5" key={item.id}><Status value={item.type} /><h2 className="mt-2 font-semibold">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.summary}</p><p className="mt-3 text-xs text-muted-foreground">Evidence: {item.evidence}</p></article>)}</section>;
  return <Table headers={["Priority", "Task", "Related record", "Due", "Status"]}>{data.tasks.map((item) => <tr key={item.id}><td><Status value={item.priority} /></td><Cell primary={item.title} secondary={item.entityType || "General"} /><td>{item.entityId || "—"}</td><td>{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "No deadline"}</td><td><Status value={item.status} /></td></tr>)}</Table>;
}

function PurchasingWorkspace({ snapshot }: { snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  const payments = data.purchasePayments || [];
  const claims = data.supplierClaims || [];
  const receiving = data.receivingSessions || [];
  const recommendations = data.reorderRecommendations || [];
  const commitments = data.transactions.filter((item) => item.type === "inventory_purchase" && item.status === "pending");
  return <div className="space-y-6">
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Metric label="Open purchase commitments" value={money(commitments.reduce((sum, item) => sum + Math.abs(item.amount), 0))} />
      <Metric label="Supplier claims" value={`${claims.filter((item) => !["closed", "credited", "rejected"].includes(item.status)).length} open`} />
      <Metric label="Payments recorded" value={money(payments.reduce((sum, item) => sum + item.amountUsd, 0))} />
      <Metric label="Reorder recommendations" value={`${recommendations.filter((item) => item.status === "open").length} open`} />
    </section>
    <PurchasingActionsPanel data={data} />
    <section className="grid gap-5 xl:grid-cols-2">
      <article className="border border-border bg-card p-5">
        <h2 className="font-semibold">1688 purchase orders</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground"><tr>{["PO", "Supplier", "Approval", "RMB/USD", "Landed cost", "Expected"].map((header) => <th className="px-4 py-3" key={header}>{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{data.purchaseOrders.map((po) => {
              const supplier = data.suppliers.find((x) => x.id === po.supplierId);
              const approval = (data.purchaseApprovals || []).find((x) => x.purchaseOrderId === po.id);
              const poPayments = payments.filter((x) => x.purchaseOrderId === po.id);
              const paidUsd = poPayments.reduce((sum, item) => sum + item.amountUsd, 0);
              const latestRate = data.exchangeRates?.find((rate) => rate.id === data.purchaseBatches?.find((batch) => batch.purchaseOrderId === po.id)?.exchangeRateId);
              return <tr key={po.id}>
                <Cell primary={po.reference} secondary={`${po.itemCount} units · ${po.status.replaceAll("_", " ")}`} />
                <td className="px-4 py-3">{supplier?.name || "Unassigned"}</td>
                <td className="px-4 py-3"><Status value={approval?.status || "not_requested"} /></td>
                <td className="px-4 py-3">{latestRate ? `¥1 = $${latestRate.rate.toFixed(4)}` : "Awaiting receipt"}</td>
                <td className="px-4 py-3">{money(paidUsd)} paid</td>
                <td className="px-4 py-3">{po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : "Not set"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </article>
      <article className="border border-border bg-card p-5">
        <h2 className="font-semibold">Parcel-to-lot receiving</h2>
        <div className="mt-4 space-y-3">{data.parcels.map((parcel) => {
          const session = receiving.find((item) => item.parcelId === parcel.id);
          return <div className="rounded-lg border border-border p-4" key={parcel.id}>
            <div className="flex flex-wrap justify-between gap-3"><b>{parcel.trackingNumber}</b><Status value={session?.status || parcel.status} /></div>
            <p className="mt-2 text-sm text-muted-foreground">{parcel.items.map((x) => `${x.expectedQuantity} expected / ${x.receivedQuantity} received`).join(" · ")}</p>
            <p className="mt-2 text-xs text-muted-foreground">Shortages, overages, and damage open supplier claims and receive clean units into explicit inventory lots.</p>
            {parcel.status !== "delivered" && <div className="mt-3"><OperationButton action="receive-parcel" id={parcel.id}>Legacy receive remaining parcel items</OperationButton></div>}
          </div>;
        })}</div>
      </article>
    </section>
    <section className="grid gap-5 xl:grid-cols-3">
      <article className="border border-border bg-card p-5">
        <h2 className="font-semibold">Supplier claims</h2>
        <div className="mt-4 space-y-3">{claims.length ? claims.map((claim) => <div className="rounded-lg border border-border p-3" key={claim.id}><div className="flex justify-between gap-3"><b>{claim.type.replaceAll("_", " ")}</b><Status value={claim.status} /></div><p className="mt-1 text-sm text-muted-foreground">{claim.quantity || 0} units · {claim.detail}</p></div>) : <p className="text-sm text-muted-foreground">No shortage, overage, or damage claims are open.</p>}</div>
      </article>
      <article className="border border-border bg-card p-5">
        <h2 className="font-semibold">Reorder planning</h2>
        <div className="mt-4 space-y-3">{recommendations.length ? recommendations.map((item) => { const variant = data.variants.find((entry) => entry.id === item.variantId); return <div className="rounded-lg border border-border p-3" key={item.id}><div className="flex justify-between gap-3"><b>{variant?.sku || item.variantId}</b><Status value={item.status} /></div><p className="mt-1 text-sm text-muted-foreground">{item.recommendedQuantity} suggested · {money(item.estimatedCostUsd)} estimated · {item.available} available / {item.incoming} incoming</p></div>; }) : <p className="text-sm text-muted-foreground">Current stock and incoming units are above reorder thresholds.</p>}</div>
      </article>
      <article className="border border-border bg-card p-5">
        <h2 className="font-semibold">Freight consolidation</h2>
        <div className="mt-4 space-y-3">{(data.freightConsolidations || []).map((item) => <div className="rounded-lg border border-border p-3" key={item.id}><div className="flex justify-between gap-3"><b>{item.supplierId ? data.suppliers.find((supplier) => supplier.id === item.supplierId)?.name || "Supplier freight" : "Multi-supplier freight"}</b><Status value={item.status} /></div><p className="mt-1 text-sm text-muted-foreground">Domestic {money(item.domesticFreightUsd)} · International {money(item.internationalFreightUsd)} · Duties {money(item.dutiesUsd)}</p></div>)}</div>
      </article>
    </section>
  </div>;
}

function SuppliersWorkspace({ snapshot }: { snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  return <div className="space-y-5">
    <Table headers={["Supplier", "Platform", "Score", "Lead time", "Defects", "Status"]}>{data.suppliers.map((item) => {
      const scorecard = (data.supplierScorecards || []).find((score) => score.supplierId === item.id);
      const overall = scorecard ? Math.round((scorecard.qualityScore + scorecard.leadTimeScore + scorecard.communicationScore + scorecard.priceScore) / 4) : undefined;
      return <tr key={item.id}><Cell primary={item.name} secondary={item.notes || "No notes"} /><td>{item.sourcePlatform}</td><td>{overall ? `${overall}/100` : "Not scored"}</td><td>{scorecard ? `${scorecard.averageLeadDays} days` : item.leadDays ? `${item.leadDays} days` : "Unknown"}</td><td>{scorecard ? `${(scorecard.defectRate * 100).toFixed(1)}%` : "Unknown"}</td><td><Status value={item.status} /></td></tr>;
    })}</Table>
    <section className="grid gap-5 xl:grid-cols-2">
      <article className="border border-border bg-card p-5">
        <h2 className="font-semibold">Contacts and communication history</h2>
        <div className="mt-4 space-y-3">
          {(data.supplierContacts || []).map((contact) => <div className="rounded-lg border border-border p-3" key={contact.id}><b>{contact.name}</b><p className="text-sm text-muted-foreground">{contact.role || "Contact"} · {contact.channel} · {contact.handle || "No handle"}</p></div>)}
          {(data.supplierCommunications || []).map((message) => <div className="rounded-lg border border-border p-3" key={message.id}><Status value={message.direction} /><p className="mt-1 text-sm">{message.subject}</p><p className="mt-1 text-xs text-muted-foreground">{message.channel} · {new Date(message.occurredAt).toLocaleString()}</p></div>)}
        </div>
      </article>
      <article className="border border-border bg-card p-5">
        <h2 className="font-semibold">Price and performance comparison</h2>
        <div className="mt-4 space-y-3">{(data.supplierPriceHistory || []).map((price) => { const variant = data.variants.find((entry) => entry.id === price.variantId); return <div className="rounded-lg border border-border p-3" key={price.id}><b>{variant?.sku || price.variantId}</b><p className="text-sm text-muted-foreground">{price.currency} {price.unitCostOriginal.toFixed(2)} · {money(price.unitCostUsd)} landed basis · MOQ {price.minimumOrderQuantity || 1}</p></div>; })}</div>
      </article>
    </section>
  </div>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="overflow-x-auto border border-border bg-card"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-muted/30 text-xs uppercase text-muted-foreground"><tr>{headers.map((header) => <th className="px-5 py-3" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></div>; }
function Cell({ primary, secondary }: { primary: string; secondary: string }) { return <td className="px-5 py-3"><b className="block">{primary}</b><span className="text-xs text-muted-foreground">{secondary}</span></td>; }
function Status({ value }: { value: string }) { return <span className="text-xs capitalize text-emerald-300">{value.replaceAll("_", " ")}</span>; }
function Metric({ label, value }: { label: string; value: string }) { return <article className="border border-border bg-card p-5"><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="mt-3 font-mono text-2xl">{value}</p></article>; }
function Rule({ title, description }: { title: string; description: string }) { return <article className="border border-border bg-card p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p><p className="mt-3 text-xs text-amber-300">Runs are queued after Supabase is connected; use the linked task fallback locally.</p></article>; }
