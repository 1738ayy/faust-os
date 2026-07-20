import Link from "next/link";
import type { AnalyticsFilters, AnalyticsModel } from "@/lib/analytics";
import { buildAnalyticsModel } from "@/lib/analytics";
import { money } from "@/lib/business-calculations";
import type { ReturnTypeSnapshot } from "@/components/operations/types";
import { AnalyticsReportsPanel } from "@/components/operations/analytics-reports-panel";

const separator = " · ";

const Header = ({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) => (
  <header>
    <p className="text-sm font-medium text-[#c8d2e6]">{eyebrow}</p>
    <h1 data-testid="page-title" className="mt-2 text-3xl font-semibold md:text-4xl">{title}</h1>
    <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">{description}</p>
  </header>
);

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="faust-surface overflow-hidden">
    <h2 className="border-b border-slate-700/45 px-5 py-4 font-semibold">{title}</h2>
    {children}
  </section>
);

const Metric = ({ label, value, href }: { label: string; value: string; href?: string }) => (
  <article className="faust-card p-5 transition hover:border-slate-400/35">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-3 font-heading text-2xl font-semibold tabular-nums">{value}</p>
    {href && <Link className="mt-3 inline-block text-xs font-medium text-[#c8d2e6] hover:text-[#edf3ff]" href={href}>Open source records →</Link>}
  </article>
);

const DecisionCallout = ({ analytics }: { analytics: AnalyticsModel }) => {
  const executive = analytics.executive;
  const topProduct = [...analytics.products].sort((a, b) => b.profit - a.profit)[0];
  const title = topProduct ? `Start with ${topProduct.sku}: it is the strongest profit signal.` : "Start with executive health before changing filters.";
  const detail = topProduct ? `${topProduct.sku} shows ${money(topProduct.profit)} profit and ${topProduct.margin.toFixed(1)}% margin. Then compare channel and supplier performance underneath.` : `${money(executive.revenue)} revenue, ${money(executive.operatingProfit)} operating profit, and ${money(executive.deployableCash)} deployable cash are the current decision anchors.`;
  return <section className="rounded-3xl border border-slate-700/45 bg-zinc-950/55 p-5 shadow-lg shadow-black/20 backdrop-blur"><p className="text-xs font-medium uppercase tracking-[0.16em] text-[#c8d2e6]">Faust recommendation</p><h2 className="mt-2 text-xl font-semibold">{title}</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">{detail}</p></section>;
};

const Row = ({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) => (
  <div className="flex justify-between gap-4 border-b border-slate-700/35 px-5 py-3 text-sm last:border-0">
    <span className="text-muted-foreground">{href ? <Link className="text-[#c8d2e6] hover:text-[#edf3ff]" href={href}>{label}</Link> : label}</span>
    <span className="text-right">{value}</span>
  </div>
);

const Percent = ({ value }: { value: number }) => <span>{value.toFixed(1)}%</span>;

export function AnalyticsDecisionEngine({ snapshot, filters = {} }: { snapshot: ReturnTypeSnapshot; filters?: AnalyticsFilters }) {
  const { data } = snapshot;
  const analytics = buildAnalyticsModel(data, filters);

  return (
    <div className="space-y-6">
      <Header
        eyebrow="Analytics decision engine"
        title="Business trends and drill-down comparisons"
        description="Analytics uses your existing Inventory, Orders, Fulfillment, Finance, Wholesale Core, Listings, and Purchasing records. It keeps the math grounded in Faust data."
      />
      <DecisionCallout analytics={analytics} />
      <ExecutiveDashboard analytics={analytics} />
      <ReportFilters analytics={analytics} filters={filters} />
      <AnalyticsReportsPanel analytics={analytics} />
      <section className="grid gap-6 xl:grid-cols-2">
        <ProductAnalytics analytics={analytics} />
        <ChannelAnalytics analytics={analytics} />
        <SupplierAnalytics analytics={analytics} />
        <PurchasingAnalytics analytics={analytics} />
        <InventoryAnalytics analytics={analytics} />
        <FulfillmentAnalytics analytics={analytics} />
        <FinanceAnalytics analytics={analytics} />
        <CustomerAnalytics analytics={analytics} />
        <GeographicAnalytics analytics={analytics} />
        <Reporting analytics={analytics} />
      </section>
    </div>
  );
}

function ReportFilters({ analytics, filters }: { analytics: AnalyticsModel; filters: AnalyticsFilters }) {
  return (
    <Panel title="Reporting controls">
      <form className="grid gap-3 p-5 md:grid-cols-6" action="/analytics">
        <label className="text-sm text-muted-foreground">From<input className="faust-field faust-focus mt-1 w-full p-2" type="date" name="from" defaultValue={filters.from} /></label>
        <label className="text-sm text-muted-foreground">To<input className="faust-field faust-focus mt-1 w-full p-2" type="date" name="to" defaultValue={filters.to} /></label>
        <label className="text-sm text-muted-foreground">Marketplace<select className="faust-field faust-focus mt-1 w-full p-2" name="marketplace" defaultValue={filters.marketplace || "all"}><option value="all">All marketplaces</option>{analytics.channels.map((channel) => <option key={channel.marketplace} value={channel.marketplace}>{channel.marketplace}</option>)}</select></label>
        <label className="text-sm text-muted-foreground">SKU<select className="faust-field faust-focus mt-1 w-full p-2" name="sku" defaultValue={filters.sku || "all"}><option value="all">All SKUs</option>{analytics.products.map((product) => <option key={product.variantId} value={product.sku}>{product.sku}</option>)}</select></label>
        <button className="self-end rounded-full bg-[#56627f] px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-950/30 transition hover:bg-[#66708d]">Apply filters</button>
        <Link className="self-end rounded-full border border-slate-700/60 bg-zinc-950/50 px-3 py-2 text-center text-sm transition hover:border-slate-400/50" href={`/api/exports/analytics?${new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][]).toString()}`}>Export CSV</Link>
      </form>
    </Panel>
  );
}

function ExecutiveDashboard({ analytics }: { analytics: AnalyticsModel }) {
  const item = analytics.executive;
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Metric label="Revenue" value={money(item.revenue)} href="/orders" />
      <Metric label="Net revenue" value={money(item.netRevenue)} href="/finance" />
      <Metric label="Gross profit" value={money(item.grossProfit)} href="/finance" />
      <Metric label="Contribution margin" value={`${item.contributionMargin.toFixed(1)}%`} href="/finance" />
      <Metric label="Operating profit" value={money(item.operatingProfit)} href="/finance" />
      <Metric label="Orders" value={String(item.orders)} href="/orders" />
      <Metric label="Units sold" value={String(item.unitsSold)} href="/inventory" />
      <Metric label="Average order value" value={money(item.averageOrderValue)} href="/orders" />
      <Metric label="Deployable cash" value={money(item.deployableCash)} href="/finance" />
      <Metric label="Inventory value" value={money(item.inventoryValue)} href="/inventory" />
      <Metric label="Pending payouts" value={money(item.pendingPayouts)} href="/finance" />
      <Metric label="Purchase commitments" value={money(item.purchaseCommitments)} href="/purchasing" />
      <Metric label="Tax reserve" value={money(item.taxReserve)} href="/finance" />
      <Metric label="Cash runway" value={item.cashRunwayDays === 999 ? "No burn" : `${item.cashRunwayDays} days`} href="/finance" />
      <Metric label="Source records" value={String(item.sourceRecordCount)} />
    </section>
  );
}

function ProductAnalytics({ analytics }: { analytics: AnalyticsModel }) {
  return (
    <Panel title="Product Analytics">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>{["SKU", "Revenue", "Profit", "Margin", "Sell-through", "Days to sell", "Turnover", "Lot drilldown", "Risk"].map((header) => <th className="px-5 py-3" key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>{analytics.products.map((product) => (
            <tr className="border-t border-slate-700/35" key={product.variantId}>
              <td className="px-5 py-3"><Link className="text-[#c8d2e6] hover:text-[#edf3ff]" href={product.sourceHref}>{product.sku}</Link><p className="text-xs text-muted-foreground">{product.title}</p></td>
              <td className="px-5 py-3">{money(product.revenue)}</td>
              <td className="px-5 py-3">{money(product.profit)}</td>
              <td className="px-5 py-3"><Percent value={product.margin} /></td>
              <td className="px-5 py-3"><Percent value={product.sellThrough} /></td>
              <td className="px-5 py-3">{product.daysToSell}</td>
              <td className="px-5 py-3">{product.inventoryTurnover}</td>
              <td className="px-5 py-3"><Link className="text-[#c8d2e6] hover:text-[#edf3ff]" href={product.lotHref}>Lot profitability</Link><p className="text-xs text-muted-foreground">{product.lotProfitability.map((lot) => `${lot.capitalUtilization}% utilized`).join(separator) || "No lots"}</p></td>
              <td className="px-5 py-3">{[product.deadStock && "dead stock", product.overstock && "overstock", product.stockoutRisk && "stockout risk", product.reorderQuantity > 0 && `reorder ${product.reorderQuantity}`].filter(Boolean).join(separator) || "healthy"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Panel>
  );
}

function ChannelAnalytics({ analytics }: { analytics: AnalyticsModel }) { return <Panel title="Channel Analytics">{analytics.channels.map((channel) => <Row key={channel.marketplace} label={channel.marketplace} href={channel.comparisonHref} value={`${money(channel.revenue)} revenue${separator}${money(channel.profit)} profit${separator}${channel.syncReliability.toFixed(1)}% sync`} />)}</Panel>; }
function SupplierAnalytics({ analytics }: { analytics: AnalyticsModel }) { return <Panel title="Supplier Analytics">{analytics.suppliers.map((supplier) => <Row key={supplier.supplierId} label={supplier.name} href={supplier.comparisonHref} value={`${money(supplier.spend)} spend${separator}${supplier.supplierScore}/100 score${separator}${(supplier.defectRate * 100).toFixed(1)}% defects${separator}${supplier.claimRate.toFixed(1)}% claims`} />)}</Panel>; }
function PurchasingAnalytics({ analytics }: { analytics: AnalyticsModel }) { const item = analytics.purchasing; return <Panel title="Purchasing Analytics"><Row label="Open POs" value={item.openPurchaseOrders} href="/purchasing" /><Row label="Receiving accuracy" value={<Percent value={item.receivingAccuracy} />} /><Row label="Freight costs" value={money(item.freightCosts)} /><Row label="Duty/customs" value={money(item.dutiesAndCustoms)} /><Row label="RMB/USD impact" value={money(item.rmbUsdImpact)} /><Row label="Purchase cycle time" value={`${item.purchaseCycleDays} days`} />{item.expectedArrivals.map((po) => <Row key={po.id} label={po.reference} value={new Date(po.expectedAt).toLocaleDateString()} href="/purchasing" />)}</Panel>; }
function InventoryAnalytics({ analytics }: { analytics: AnalyticsModel }) { const item = analytics.inventory; return <Panel title="Inventory Analytics"><Row label="Carrying value" value={money(item.carryingValue)} href="/inventory" /><Row label="Low stock" value={item.lowStock} /><Row label="Dead stock" value={item.deadStock} /><Row label="Incoming inventory" value={`${item.incomingInventory} units`} /><Row label="Capital tied up" value={money(item.capitalTiedUp)} /><Row label="Safety stock" value={`${item.safetyStock} units`} /><Row label="Reorder point" value={`${item.reorderPointUnits} units`} />{item.lotAging.slice(0, 5).map((lot) => <Row key={lot.lotId} label={`${lot.sku} lot aging`} value={`${lot.ageDays} days${separator}${money(lot.remainingValue)}${separator}${lot.capitalUtilization}% capital utilized`} href={lot.sourceHref} />)}</Panel>; }
function FulfillmentAnalytics({ analytics }: { analytics: AnalyticsModel }) { const item = analytics.fulfillment; return <Panel title="Fulfillment Analytics"><Row label="Pick time" value={`${item.pickHours} hours`} href="/shipping" /><Row label="Pack time" value={`${item.packHours} hours`} /><Row label="Ship time" value={`${item.shipHours} hours`} /><Row label="Same-day shipping" value={<Percent value={item.sameDayShippingRate} />} /><Row label="Late shipment" value={<Percent value={item.lateShipmentRate} />} /><Row label="Exception rate" value={<Percent value={item.exceptionRate} />} /><Row label="Shipping cost/order" value={money(item.shippingCostPerOrder)} />{item.carrierPerformance.map((carrier) => <Row key={carrier.carrier} label={carrier.carrier} value={`${carrier.delivered}/${carrier.shipments} delivered`} />)}</Panel>; }
function FinanceAnalytics({ analytics }: { analytics: AnalyticsModel }) { const item = analytics.finance; return <Panel title="Finance Analytics"><Row label="Cash flow" value={money(item.cashFlow)} href="/finance" /><Row label="Forecast accuracy" value={<Percent value={item.forecastAccuracy} />} /><Row label="Payout discrepancies" value={item.payoutDiscrepancies} /><Row label="Budget variance" value={item.budgetVariance.map((budget) => `${budget.category}: ${money(budget.variance)}`).join(separator) || "No budgets"} />{item.monthlyProfitAndLoss.map((month) => <Row key={month.month} label={`Monthly P&L ${month.month}`} value={money(month.amount)} />)}{item.taxReserveTrend.map((reserve) => <Row key={`${reserve.date}-${reserve.amount}`} label={`Tax reserve ${new Date(reserve.date).toLocaleDateString()}`} value={money(reserve.amount)} />)}</Panel>; }
function CustomerAnalytics({ analytics }: { analytics: AnalyticsModel }) { return <Panel title="Customer Analytics"><Row label="Repeat purchase rate" value={<Percent value={analytics.customers.repeatPurchaseRate} />} />{analytics.customers.customers.map((customer) => <Row key={customer.customerId} label={customer.name} href="/customers" value={`${money(customer.lifetimeRevenue)} revenue${separator}${money(customer.lifetimeProfit)} profit${separator}${customer.marketplaceOrigin}`} />)}</Panel>; }
function GeographicAnalytics({ analytics }: { analytics: AnalyticsModel }) { return <Panel title="Geographic Analytics">{analytics.geography.map((region) => <Row key={region.state} label={region.state} value={`${region.orders} orders${separator}${money(region.revenue)} revenue${separator}${money(region.shippingCost)} shipping${separator}${region.returnRate.toFixed(1)}% returns`} />)}</Panel>; }
function Reporting({ analytics }: { analytics: AnalyticsModel }) { return <Panel title="Saved Reports">{analytics.reports.map((report) => <Row key={report.id} label={report.name} href={`/analytics?report=${report.id}`} value={`${report.sections.join(separator)}${separator}schedule ${report.schedule?.frequency || "none"}`} />)}{analytics.filterPresets.map((preset) => <Row key={preset.id} label={`Filter preset: ${preset.name}`} value={Object.keys(preset.filters).length ? Object.entries(preset.filters).map(([key, value]) => `${key}=${value}`).join(separator) : "All data"} />)}{analytics.reportRuns.map((run) => <Row key={run.id} label={`Run ${new Date(run.createdAt).toLocaleString()}`} value={`${run.status}${separator}${run.exportedRowCount} rows`} />)}</Panel>; }
