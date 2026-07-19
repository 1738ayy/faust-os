import { ArrowRight } from "lucide-react";

import {
  DataCard,
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  PrimaryButton,
  StatusBadge,
  TableCell,
  formatStatus,
} from "@/components/faust/design-system";
import { AiRecommendationPanel, type FaustRecommendation } from "@/components/faust/ai-recommendation-panel";
import { OperationButton } from "@/components/operations/operation-button";
import { PurchasingActionsPanel } from "@/components/operations/purchasing-actions-panel";
import type { ReturnTypeSnapshot } from "@/components/operations/types";
import { availableUnits, money, orderProfit } from "@/lib/business-calculations";
import { getProductReadiness, readinessLabel } from "@/lib/product-readiness";

type ModuleName = "inventory" | "orders" | "listings" | "sourcing" | "purchasing" | "shipping" | "finance" | "suppliers" | "customers" | "analytics" | "automations" | "ai" | "tasks";

const meta: Record<ModuleName, { title: string; question: string; description: string; action?: [string, string]; empty: [string, string, string] }> = {
  inventory: { title: "Inventory", question: "What do I own, and what needs attention?", description: "Available, reserved, incoming, damaged, lost, and waiting-for-review stock in one place.", action: ["Source product", "/sourcing"], empty: ["No inventory yet", "Receive a purchase or add stock manually to start tracking products.", "/inventory"] },
  orders: { title: "Orders", question: "What needs to be processed or shipped?", description: "Sales, reservations, returns, and fulfillment progress ordered by urgency.", action: ["Shipping queue", "/shipping"], empty: ["Nothing needs processing right now", "New marketplace orders will appear here when they are imported.", "/orders"] },
  listings: { title: "Listings", question: "What is ready to publish or requires changes?", description: "Marketplace drafts, listing readiness, and channel sync issues without raw queue noise.", empty: ["No listing drafts yet", "Choose a product and generate marketplace drafts.", "/catalog"] },
  sourcing: { title: "Opportunities", question: "What should I source?", description: "Import from Superbuy, review costs, and decide what deserves a product card.", action: ["Open analyzer", "/opportunity-analyzer"], empty: ["No sourcing opportunities yet", "Use the Faust extension on a supported product page.", "/opportunity-analyzer"] },
  purchasing: { title: "Purchasing & inbound", question: "What should I buy or reorder?", description: "1688 purchase plans, supplier performance, inbound parcels, and cash commitments.", empty: ["No purchase plans yet", "Convert a strong opportunity into a product, then draft the first purchase.", "/sourcing"] },
  shipping: { title: "Shipping & fulfillment", question: "What needs to ship, and what is delayed?", description: "Pick, pack, label, dispatch, and resolve shipment issues.", empty: ["No shipments waiting", "Orders ready to pack will appear here.", "/orders"] },
  finance: { title: "Finance", question: "Where is my money?", description: "Cash, profit, payouts, expenses, deployable capital, and tied-up inventory value.", empty: ["No finance records yet", "Sales, purchases, payouts, and expenses will build the ledger.", "/finance"] },
  suppliers: { title: "Suppliers", question: "Which suppliers should I trust?", description: "Supplier health, communication, pricing, lead time, and claims.", empty: ["No suppliers yet", "Import from Superbuy or create a supplier to track performance.", "/sourcing"] },
  customers: { title: "Customers", question: "Who buys, returns, and repeats?", description: "Repeat buyers, order history, issues, and lifetime value.", empty: ["No customers yet", "Customer records appear after orders are imported.", "/orders"] },
  analytics: { title: "Analytics", question: "What changed, and why?", description: "Decision views derived from real operations, finance, inventory, and purchasing records.", empty: ["No analytics yet", "Import products, orders, and finance records to unlock trends.", "/"] },
  automations: { title: "Automations", question: "What is Faust handling for me?", description: "Safe operating rules that create tasks, approvals, and background work.", empty: ["No automations yet", "Start with a template such as low stock, delayed shipment, or negative margin review.", "/automations"] },
  ai: { title: "AI Center", question: "What should I do next?", description: "Ask Faust operating questions and receive grounded answers with evidence.", empty: ["No recommendations yet", "Ask Faust a question to generate your first grounded recommendation.", "/ai-center"] },
  tasks: { title: "Tasks", question: "What needs my attention?", description: "Review, approval, shipping, listing, and follow-up work.", empty: ["No tasks yet", "Faust will create tasks when something needs your attention.", "/"] },
};

function statusTone(value?: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (!value) return "neutral";
  if (["active", "approved", "completed", "delivered", "synced", "healthy", "closed", "paid"].includes(value)) return "success";
  if (["failed", "rejected", "cancelled", "damaged", "lost", "risk_locked"].includes(value)) return "danger";
  if (["pending", "pending_approval", "open", "review_required", "not_requested", "quarantine"].includes(value)) return "warning";
  return "neutral";
}

export function ModuleWorkspace({ module, snapshot }: { module: ModuleName; snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  const info = meta[module];
  const empty = data.mode === "empty" && module !== "sourcing";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Workspace" title={info.title} description={info.description} action={info.action ? { label: info.action[0], href: info.action[1] } : undefined} />
      <section className="rounded-3xl border border-red-950/45 bg-zinc-950/55 p-5 shadow-lg shadow-black/20 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-red-300">Primary question</p>
        <h2 className="mt-2 text-xl font-semibold">{info.question}</h2>
      </section>
      {!empty && <ModuleRecommendation module={module} snapshot={snapshot} />}
      {!empty && <DecisionSummary module={module} snapshot={snapshot} />}
      {empty ? <Empty module={module} /> : <Content module={module} snapshot={snapshot} />}
    </div>
  );
}

function ModuleRecommendation({ module, snapshot }: { module: ModuleName; snapshot: ReturnTypeSnapshot }) {
  const item = buildModuleRecommendation(module, snapshot);
  if (!item) return null;
  return <AiRecommendationPanel item={item} />;
}

function buildModuleRecommendation(module: ModuleName, snapshot: ReturnTypeSnapshot): FaustRecommendation | null {
  const { data, metrics, reorders } = snapshot;
  const firstVariant = data.variants[0];
  const firstProduct = firstVariant ? data.products.find((product) => product.id === firstVariant.productId) : undefined;
  const readiness = firstVariant ? getProductReadiness(data, firstVariant, firstProduct) : undefined;
  const orderQueue = data.orders.filter((order) => ["paid", "confirmed", "reserved", "ready_to_pack", "packed", "ready_to_ship"].includes(order.status));
  const listingIssues = (data.channelListingDrafts || []).filter((draft) => draft.validationErrors.length || draft.status === "failed" || draft.syncState === "risk_locked");
  const financeCash = data.transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const openTasks = data.tasks.filter((task) => task.status !== "done");
  const reorderAvailable = reorders[0] ? data.balances.filter((balance) => balance.variantId === reorders[0].variant.id).reduce((sum, balance) => sum + availableUnits(balance), 0) : 0;

  if (module === "inventory" && reorders.length) return { title: "Reorder risk is active", recommendation: `Faust recommends reviewing ${reorders[0].variant.sku} before available stock runs out.`, evidence: `${reorderAvailable} available, reorder point ${reorders[0].variant.reorderPoint}, ${metrics.incoming} incoming units across inventory.`, metrics: [`${reorders.length} reorder alert(s)`, `${metrics.incoming} incoming units`], confidence: 0.82, actionLabel: "Review stock", href: "/inventory" };
  if (module === "orders" && orderQueue.length) return { title: "Process fulfillment queue first", recommendation: "Ship or reserve the oldest actionable orders before reviewing lower-priority order history.", evidence: `${orderQueue.length} order(s) currently need reservation, packing, label, or shipping work.`, metrics: [`${orderQueue.length} actionable orders`, `${money(metrics.revenue)} recorded revenue`], confidence: 0.78, actionLabel: "Open shipping", href: "/shipping" };
  if (module === "listings" && listingIssues.length) return { title: "Fix listing readiness before publishing", recommendation: "Resolve listing validation and sync issues so stock is not oversold across channels.", evidence: `${listingIssues.length} channel draft(s) have validation errors, failed state, or risk locks.`, metrics: [`${listingIssues.length} listing issue(s)`], confidence: 0.76, actionLabel: "Review listings", href: "/listings" };
  if (module === "purchasing" && reorders.length) return { title: "Rebuy before stock thins out", recommendation: `Create or review a purchase plan for ${reorders[0].variant.sku}.`, evidence: `${reorderAvailable} available against reorder point ${reorders[0].variant.reorderPoint}.`, metrics: [`Suggested order ${reorders[0].quantity}`, `${reorders.length} reorder candidate(s)`], confidence: 0.8, actionLabel: "Create purchase plan", href: "/purchasing" };
  if (module === "finance") return { title: "Keep cash decisions tied to operations", recommendation: "Review deployable cash before buying more inventory or approving new expenses.", evidence: `${money(financeCash)} net transaction balance from recorded ledger activity.`, metrics: [`Revenue ${money(metrics.revenue)}`, `Profit ${money(metrics.netProfit)}`], confidence: 0.68, actionLabel: "Review finance", href: "/finance" };
  if (module === "sourcing" && readiness && firstVariant) return { title: "Move the best sourced item toward listing", recommendation: `${firstVariant.sku} is currently ${readinessLabel(readiness.status).toLowerCase()}. ${readiness.nextAction} is the next best step.`, evidence: readiness.missing.length ? `Missing ${readiness.missing.join(", ")}.` : "Required product, pricing, photo, and inventory signals are present.", metrics: [`Readiness ${readiness.score}/100`], confidence: readiness.score / 100, missingData: readiness.missing, actionLabel: readiness.nextAction, href: "/catalog" };
  if (module === "tasks" && openTasks.length) return { title: "Clear the attention queue", recommendation: "Work the highest-priority open tasks before adding new operating work.", evidence: `${openTasks.length} open task(s) are waiting across Faust.`, metrics: [`${openTasks.length} open tasks`], confidence: 0.72, actionLabel: "Review tasks", href: "/tasks" };
  return null;
}

function Empty({ module }: { module: ModuleName }) {
  const [title, description, href] = meta[module].empty;
  return <EmptyState title={title} description={description} action={{ label: "Get started", href }} />;
}

function DecisionSummary({ module, snapshot }: { module: ModuleName; snapshot: ReturnTypeSnapshot }) {
  const { data, metrics, reorders } = snapshot;
  const info = meta[module];
  const ordersNeedingWork = data.orders.filter((order) => ["paid", "confirmed", "reserved", "ready_to_pack", "packed", "ready_to_ship"].includes(order.status)).length;
  const listingIssues = (data.channelListingDrafts || []).filter((draft) => draft.validationErrors.length || draft.status === "failed" || draft.syncState === "risk_locked").length;
  const openTasks = data.tasks.filter((task) => task.status !== "done").length;
  const pendingPayouts = data.transactions.filter((transaction) => transaction.status === "pending").reduce((sum, transaction) => sum + transaction.amount, 0);
  const action: [string, string] = info.action || ["Get started", meta[module].empty[2]];
  const metricsByModule: Record<ModuleName, [string, string, string?][]> = {
    inventory: [["Available stock", String(metrics.availableUnits), "ready to sell"], ["Incoming", String(metrics.incoming), "units inbound"], ["Reorder alerts", String(reorders.length), "need review"]],
    orders: [["Needs processing", String(ordersNeedingWork), "orders"], ["Revenue", money(metrics.revenue), "recorded"], ["Average order", money(metrics.averageOrderValue), "AOV"]],
    listings: [["Draft issues", String(listingIssues), "need review"], ["Live listings", String(data.listings.filter((listing) => listing.status === "active").length), "active"], ["Marketplaces", String(new Set(data.listings.map((listing) => listing.marketplace)).size), "connected"]],
    sourcing: [["Products", String(data.products.length), "in Faust"], ["Source items", String(data.products.filter((product) => product.sourceUrl).length), "imported"], ["Inventory value", money(metrics.inventoryValue), "basis"]],
    purchasing: [["Reorder candidates", String(reorders.length), "ready"], ["Open POs", String(data.purchaseOrders.filter((po) => po.status !== "received").length), "plans"], ["Incoming", String(metrics.incoming), "units"]],
    shipping: [["Ready to ship", String(metrics.readyToShip), "orders"], ["Exceptions", String(data.notices.filter((notice) => notice.category === "shipping" && !notice.resolved).length), "open"], ["Orders waiting", String(ordersNeedingWork), "work queue"]],
    finance: [["Cash", money(metrics.cash), "cleared"], ["Pending payouts", money(pendingPayouts), "expected"], ["Profit", money(metrics.netProfit), "contribution"]],
    suppliers: [["Suppliers", String(data.suppliers.length), "tracked"], ["Open POs", String(data.purchaseOrders.filter((po) => po.status !== "received").length), "linked"], ["Reorder alerts", String(reorders.length), "supplier demand"]],
    customers: [["Customers", String(data.customers.length), "known"], ["Orders", String(metrics.orders), "completed"], ["Average order", money(metrics.averageOrderValue), "AOV"]],
    analytics: [["Revenue", money(metrics.revenue), "source-backed"], ["Margin", `${metrics.margin.toFixed(1)}%`, "contribution"], ["Units sold", String(metrics.units), "tracked"]],
    automations: [["Rules", String(data.automationRules?.length || 0), "installed"], ["Open tasks", String(openTasks), "created"], ["Failed tasks", String((data.automationDeadLetters || []).filter((entry) => entry.status === "open").length), "need review"]],
    ai: [["Insights", String(data.insights.length), "available"], ["Open tasks", String(openTasks), "actionable"], ["Evidence records", String(data.activity.length), "audit trail"]],
    tasks: [["Open tasks", String(openTasks), "waiting"], ["Critical", String(data.tasks.filter((task) => task.priority === "critical" && task.status !== "done").length), "urgent"], ["High priority", String(data.tasks.filter((task) => task.priority === "high" && task.status !== "done").length), "next"]],
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_2fr]">
      <DataCard title="Next best action" description="The quickest move that protects revenue, cash, or operational flow.">
        <PrimaryButton href={action[1]}>{action[0]}<ArrowRight size={15} /></PrimaryButton>
      </DataCard>
      <section className="grid gap-4 md:grid-cols-3">
        {metricsByModule[module].map(([label, value, detail]) => <MetricCard key={label} label={label} value={value} detail={detail} />)}
      </section>
    </section>
  );
}

function Content({ module, snapshot }: { module: ModuleName; snapshot: ReturnTypeSnapshot }) {
  const { data, metrics } = snapshot;

  if (module === "inventory") return <InventoryTable snapshot={snapshot} />;
  if (module === "orders") return <OrdersTable snapshot={snapshot} />;
  if (module === "listings") return <ListingsTable snapshot={snapshot} />;
  if (module === "sourcing") return <SourcingSummary />;
  if (module === "purchasing") return <PurchasingWorkspace snapshot={snapshot} />;
  if (module === "shipping") return <ShippingTable snapshot={snapshot} />;
  if (module === "finance") return <FinanceTable snapshot={snapshot} />;
  if (module === "suppliers") return <SuppliersWorkspace snapshot={snapshot} />;
  if (module === "customers") return <CustomersTable snapshot={snapshot} />;
  if (module === "analytics") return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard label="Revenue" value={money(metrics.revenue)} /><MetricCard label="Gross profit" value={money(metrics.grossProfit)} /><MetricCard label="Net profit" value={money(metrics.netProfit)} /><MetricCard label="Average order" value={money(metrics.averageOrderValue)} /></section>;
  if (module === "automations") return <section className="grid gap-4 md:grid-cols-2"><Rule title="Low-stock review" description="Creates a review task when available units reach the reorder point." /><Rule title="Late-shipment escalation" description="Creates a priority task when an unshipped order passes its ship-by date." /></section>;
  if (module === "ai") return <section className="grid gap-4 md:grid-cols-2">{data.insights.map((item) => <DataCard key={item.id}><StatusBadge value={item.type} /><h2 className="mt-3 font-semibold">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.summary}</p><p className="mt-3 text-xs text-muted-foreground">Evidence: {item.evidence}</p></DataCard>)}</section>;
  return <TasksTable snapshot={snapshot} />;
}

function InventoryTable({ snapshot }: { snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  return <DataTable headers={["SKU", "Location", "On hand", "Reserved", "Available", "Incoming", "Cost"]}>{data.variants.map((variant) => { const balance = data.balances.find((x) => x.variantId === variant.id); const location = data.locations.find((x) => x.id === balance?.locationId); return <tr key={variant.id}><TableCell primary={variant.sku} secondary={variant.title} /><td className="px-5 py-3">{location?.label || "Unassigned"}</td><td className="px-5 py-3">{balance?.onHand || 0}</td><td className="px-5 py-3">{balance?.reserved || 0}</td><td className="px-5 py-3">{balance ? availableUnits(balance) : 0}</td><td className="px-5 py-3">{balance?.incoming || 0}</td><td className="px-5 py-3">{money(variant.landedUnitCost)}</td></tr>; })}</DataTable>;
}

function OrdersTable({ snapshot }: { snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  return <DataTable headers={["Order", "Customer", "Items", "Status", "Revenue", "Profit", "Action"]}>{data.orders.map((order) => { const profit = orderProfit(order, data.variants); return <tr key={order.id}><TableCell primary={order.number} secondary={order.marketplace} /><td className="px-5 py-3">{data.customers.find((x) => x.id === order.customerId)?.name || "Unmatched"}</td><td className="px-5 py-3">{order.items.map((item) => `${item.title} ×${item.quantity}`).join(", ")}</td><td className="px-5 py-3"><StatusBadge value={order.status} tone={statusTone(order.status)} /></td><td className="px-5 py-3">{money(profit.revenue)}</td><td className="px-5 py-3">{money(profit.netProfit)}</td><td className="px-5 py-3">{order.status === "ready_to_ship" ? <OperationButton action="transition-order" id={order.id} status="shipped">Ship</OperationButton> : "No action"}</td></tr>; })}</DataTable>;
}

function ListingsTable({ snapshot }: { snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  return <DataTable headers={["Listing", "Marketplace", "Price", "Quantity", "Status", "Next step"]}>{data.listings.map((listing) => <tr key={listing.id}><TableCell primary={listing.title} secondary={listing.marketplaceUrl || "External listing not confirmed"} /><td className="px-5 py-3">{listing.marketplace}</td><td className="px-5 py-3">{money(listing.price)}</td><td className="px-5 py-3">{listing.quantity}</td><td className="px-5 py-3"><StatusBadge value={listing.status} tone={statusTone(listing.status)} /></td><td className="px-5 py-3">{listing.syncState === "manual" ? "Publish manually, then confirm the URL" : formatStatus(listing.syncState)}</td></tr>)}</DataTable>;
}

function SourcingSummary() {
  return <DataCard title="Opportunity Analyzer" description="Import from Superbuy or 1688, review the source facts, then compare landed cost, pricing, margin, and risk before creating a product."><PrimaryButton href="/opportunity-analyzer">Open analyzer<ArrowRight size={15} /></PrimaryButton></DataCard>;
}

function ShippingTable({ snapshot }: { snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  return <DataTable headers={["Order", "Items", "Status", "Tracking", "Ship by", "Action"]}>{data.orders.map((order) => <tr key={order.id}><TableCell primary={order.number} secondary={order.marketplace} /><td className="px-5 py-3">{order.items.map((x) => x.title).join(", ")}</td><td className="px-5 py-3"><StatusBadge value={order.status} tone={statusTone(order.status)} /></td><td className="px-5 py-3">{order.trackingNumber || "Add tracking"}</td><td className="px-5 py-3">{order.shipBy ? new Date(order.shipBy).toLocaleDateString() : "Not set"}</td><td className="px-5 py-3">{order.status === "ready_to_ship" ? <OperationButton action="transition-order" id={order.id} status="shipped">Confirm dispatch</OperationButton> : "No action"}</td></tr>)}</DataTable>;
}

function FinanceTable({ snapshot }: { snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  return <DataTable headers={["Date", "Description", "Category", "Amount", "Status"]}>{data.transactions.map((item) => <tr key={item.id}><td className="px-5 py-3">{new Date(item.occurredAt).toLocaleDateString()}</td><TableCell primary={item.description} secondary={formatStatus(item.type)} /><td className="px-5 py-3">{item.category}</td><td className={`px-5 py-3 ${item.amount >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(item.amount)}</td><td className="px-5 py-3"><StatusBadge value={item.status} tone={statusTone(item.status)} /></td></tr>)}</DataTable>;
}

function CustomersTable({ snapshot }: { snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  return <DataTable headers={["Customer", "Location", "Orders", "Lifetime value", "Issues"]}>{data.customers.map((item) => <tr key={item.id}><TableCell primary={item.name} secondary={item.email || "No email"} /><td className="px-5 py-3">{[item.city, item.state].filter(Boolean).join(", ") || "Not set"}</td><td className="px-5 py-3">{item.orderCount}</td><td className="px-5 py-3">{money(item.lifetimeValue)}</td><td className="px-5 py-3">{item.issueCount}</td></tr>)}</DataTable>;
}

function TasksTable({ snapshot }: { snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  return <DataTable headers={["Priority", "Task", "Related work", "Due", "Status"]}>{data.tasks.map((item) => <tr key={item.id}><td className="px-5 py-3"><StatusBadge value={item.priority} tone={statusTone(item.priority)} /></td><TableCell primary={item.title} secondary={item.entityType || "General"} /><td className="px-5 py-3">{item.entityType ? formatStatus(item.entityType) : "General"}</td><td className="px-5 py-3">{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "No deadline"}</td><td className="px-5 py-3"><StatusBadge value={item.status} tone={statusTone(item.status)} /></td></tr>)}</DataTable>;
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
      <MetricCard label="Purchase commitments" value={money(commitments.reduce((sum, item) => sum + Math.abs(item.amount), 0))} />
      <MetricCard label="Supplier claims" value={`${claims.filter((item) => !["closed", "credited", "rejected"].includes(item.status)).length} open`} />
      <MetricCard label="Payments recorded" value={money(payments.reduce((sum, item) => sum + item.amountUsd, 0))} />
      <MetricCard label="Reorder recommendations" value={`${recommendations.filter((item) => item.status === "open").length} open`} />
    </section>
    <PurchasingActionsPanel data={data} />
    <section className="grid gap-5 xl:grid-cols-2">
      <DataCard title="1688 purchase orders">
        <DataTable headers={["PO", "Supplier", "Approval", "RMB/USD", "Landed cost", "Expected"]} minWidth={760}>{data.purchaseOrders.map((po) => {
          const supplier = data.suppliers.find((x) => x.id === po.supplierId);
          const approval = (data.purchaseApprovals || []).find((x) => x.purchaseOrderId === po.id);
          const poPayments = payments.filter((x) => x.purchaseOrderId === po.id);
          const paidUsd = poPayments.reduce((sum, item) => sum + item.amountUsd, 0);
          const latestRate = data.exchangeRates?.find((rate) => rate.id === data.purchaseBatches?.find((batch) => batch.purchaseOrderId === po.id)?.exchangeRateId);
          return <tr key={po.id}><TableCell primary={po.reference} secondary={`${po.itemCount} units · ${formatStatus(po.status)}`} /><td className="px-5 py-3">{supplier?.name || "Unassigned"}</td><td className="px-5 py-3"><StatusBadge value={approval?.status || "not_requested"} tone={statusTone(approval?.status || "not_requested")} /></td><td className="px-5 py-3">{latestRate ? `¥1 = $${latestRate.rate.toFixed(4)}` : "Awaiting receipt"}</td><td className="px-5 py-3">{money(paidUsd)} paid</td><td className="px-5 py-3">{po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : "Not set"}</td></tr>;
        })}</DataTable>
      </DataCard>
      <DataCard title="Parcel-to-lot receiving">
        <div className="space-y-3">{data.parcels.map((parcel) => {
          const session = receiving.find((item) => item.parcelId === parcel.id);
          return <div className="faust-card p-4" key={parcel.id}><div className="flex flex-wrap justify-between gap-3"><b>{parcel.trackingNumber}</b><StatusBadge value={session?.status || parcel.status} tone={statusTone(session?.status || parcel.status)} /></div><p className="mt-2 text-sm text-muted-foreground">{parcel.items.map((x) => `${x.expectedQuantity} expected / ${x.receivedQuantity} received`).join(" · ")}</p><p className="mt-2 text-xs text-muted-foreground">Shortages, overages, and damaged goods open supplier claims and receive clean units into inventory lots.</p>{parcel.status !== "delivered" && <div className="mt-3"><OperationButton action="receive-parcel" id={parcel.id}>Receive remaining items</OperationButton></div>}</div>;
        })}</div>
      </DataCard>
    </section>
    <section className="grid gap-5 xl:grid-cols-3">
      <DataCard title="Supplier claims"><div className="space-y-3">{claims.length ? claims.map((claim) => <div className="faust-card p-3" key={claim.id}><div className="flex justify-between gap-3"><b>{formatStatus(claim.type)}</b><StatusBadge value={claim.status} tone={statusTone(claim.status)} /></div><p className="mt-1 text-sm text-muted-foreground">{claim.quantity || 0} units · {claim.detail}</p></div>) : <p className="text-sm text-muted-foreground">No shortage, overage, or damage claims are open.</p>}</div></DataCard>
      <DataCard title="Reorder planning"><div className="space-y-3">{recommendations.length ? recommendations.map((item) => { const variant = data.variants.find((entry) => entry.id === item.variantId); return <div className="faust-card p-3" key={item.id}><div className="flex justify-between gap-3"><b>{variant?.sku || "Unknown SKU"}</b><StatusBadge value={item.status} tone={statusTone(item.status)} /></div><p className="mt-1 text-sm text-muted-foreground">{item.recommendedQuantity} suggested · {money(item.estimatedCostUsd)} estimated · {item.available} available / {item.incoming} incoming</p></div>; }) : <p className="text-sm text-muted-foreground">Current stock and incoming units are above reorder thresholds.</p>}</div></DataCard>
      <DataCard title="Freight consolidation"><div className="space-y-3">{(data.freightConsolidations || []).map((item) => <div className="faust-card p-3" key={item.id}><div className="flex justify-between gap-3"><b>{item.supplierId ? data.suppliers.find((supplier) => supplier.id === item.supplierId)?.name || "Supplier freight" : "Multi-supplier freight"}</b><StatusBadge value={item.status} tone={statusTone(item.status)} /></div><p className="mt-1 text-sm text-muted-foreground">Domestic {money(item.domesticFreightUsd)} · International {money(item.internationalFreightUsd)} · Duties {money(item.dutiesUsd)}</p></div>)}</div></DataCard>
    </section>
  </div>;
}

function SuppliersWorkspace({ snapshot }: { snapshot: ReturnTypeSnapshot }) {
  const { data } = snapshot;
  return <div className="space-y-5">
    <DataTable headers={["Supplier", "Platform", "Score", "Lead time", "Defects", "Status"]}>{data.suppliers.map((item) => {
      const scorecard = (data.supplierScorecards || []).find((score) => score.supplierId === item.id);
      const overall = scorecard ? Math.round((scorecard.qualityScore + scorecard.leadTimeScore + scorecard.communicationScore + scorecard.priceScore) / 4) : undefined;
      return <tr key={item.id}><TableCell primary={item.name} secondary={item.notes || "No notes"} /><td className="px-5 py-3">{item.sourcePlatform}</td><td className="px-5 py-3">{overall ? `${overall}/100` : "Not scored"}</td><td className="px-5 py-3">{scorecard ? `${scorecard.averageLeadDays} days` : item.leadDays ? `${item.leadDays} days` : "Unknown"}</td><td className="px-5 py-3">{scorecard ? `${(scorecard.defectRate * 100).toFixed(1)}%` : "Unknown"}</td><td className="px-5 py-3"><StatusBadge value={item.status} tone={statusTone(item.status)} /></td></tr>;
    })}</DataTable>
    <section className="grid gap-5 xl:grid-cols-2">
      <DataCard title="Contacts and communication history"><div className="space-y-3">{(data.supplierContacts || []).map((contact) => <div className="faust-card p-3" key={contact.id}><b>{contact.name}</b><p className="text-sm text-muted-foreground">{contact.role || "Contact"} · {contact.channel} · {contact.handle || "No handle"}</p></div>)}{(data.supplierCommunications || []).map((message) => <div className="faust-card p-3" key={message.id}><StatusBadge value={message.direction} /><p className="mt-1 text-sm">{message.subject}</p><p className="mt-1 text-xs text-muted-foreground">{message.channel} · {new Date(message.occurredAt).toLocaleString()}</p></div>)}</div></DataCard>
      <DataCard title="Price and performance comparison"><div className="space-y-3">{(data.supplierPriceHistory || []).map((price) => { const variant = data.variants.find((entry) => entry.id === price.variantId); return <div className="faust-card p-3" key={price.id}><b>{variant?.sku || "Unknown SKU"}</b><p className="text-sm text-muted-foreground">{price.currency} {price.unitCostOriginal.toFixed(2)} · {money(price.unitCostUsd)} landed basis · MOQ {price.minimumOrderQuantity || 1}</p></div>; })}</div></DataCard>
    </section>
  </div>;
}

function Rule({ title, description }: { title: string; description: string }) {
  return <DataCard title={title} description={description}><p className="text-sm text-amber-200">Runs create tasks and approvals through the background worker when connected.</p></DataCard>;
}
