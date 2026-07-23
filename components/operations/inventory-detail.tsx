import Link from "next/link";
import { ArrowRight, PackageCheck, TrendingDown, TrendingUp } from "lucide-react";

import type { OperatingData, Variant } from "@/domain/business";
import { availableUnits, money } from "@/lib/business-calculations";
import { productCoverImage } from "@/lib/product-images";
import { activeVariants } from "@/lib/product-state";
import { ProductImage } from "@/components/products/product-image";

type InventoryCard = ReturnType<typeof buildInventoryCard>;

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function variantOrders(data: OperatingData, variant: Variant) {
  return data.orders.filter((order) => order.items.some((item) => item.variantId === variant.id));
}

function buildInventoryCard(data: OperatingData, variant: Variant) {
  const product = data.products.find((entry) => entry.id === variant.productId);
  const balances = data.balances.filter((balance) => balance.variantId === variant.id);
  const orders = variantOrders(data, variant);
  const soldUnits = sum(orders.flatMap((order) => order.items.filter((item) => item.variantId === variant.id).map((item) => item.quantity)));
  const recentCutoff = Date.now() - 30 * 86_400_000;
  const recentOrders = orders.filter((order) => new Date(order.orderedAt).getTime() >= recentCutoff);
  const recentUnits = sum(recentOrders.flatMap((order) => order.items.filter((item) => item.variantId === variant.id).map((item) => item.quantity)));
  const firstSaleAt = orders.map((order) => new Date(order.orderedAt)).sort((a, b) => a.getTime() - b.getTime())[0];
  const salesWindowDays = firstSaleAt ? daysBetween(firstSaleAt, new Date()) : 30;
  const weeklyVelocity = recentUnits ? recentUnits / 4.3 : soldUnits ? soldUnits / Math.max(1, salesWindowDays / 7) : 0;
  const dailyVelocity = weeklyVelocity / 7;
  const onHand = sum(balances.map((balance) => balance.onHand));
  const reserved = sum(balances.map((balance) => balance.reserved));
  const incoming = sum(balances.map((balance) => balance.incoming));
  const available = sum(balances.map((balance) => availableUnits(balance)));
  const purchaseOrders = data.purchaseOrders.filter((po) => po.items.some((item) => item.variantId === variant.id));
  const openPurchaseOrders = purchaseOrders.filter((po) => po.status !== "received");
  const expectedDates = openPurchaseOrders.map((po) => po.expectedAt).filter(Boolean) as string[];
  const nextEta = expectedDates.sort()[0];
  const supplier = data.suppliers.find((entry) => entry.id === product?.supplierId);
  const scorecard = data.supplierScorecards?.find((entry) => entry.supplierId === supplier?.id);
  const movements = data.stockMovements.filter((movement) => movement.variantId === variant.id).slice(0, 5);
  const listings = data.listings.filter((listing) => listing.variantId === variant.id);
  const channelSales = new Map<string, number>();
  for (const order of orders) {
    const quantity = sum(order.items.filter((item) => item.variantId === variant.id).map((item) => item.quantity));
    if (quantity) channelSales.set(order.marketplace, (channelSales.get(order.marketplace) || 0) + quantity);
  }
  const projectedDemand30 = Math.max(weeklyVelocity ? Math.ceil(weeklyVelocity * 4.3) : 0, recentUnits);
  const daysOfCoverage = dailyVelocity > 0 ? Math.floor((available + incoming) / dailyVelocity) : null;
  const reorderQuantity = Math.max(variant.reorderQuantity, Math.max(0, projectedDemand30 - available - incoming + variant.reorderPoint));
  const isLow = available <= variant.reorderPoint;
  const isDeadStock = available > 0 && !recentUnits && !orders.some((order) => new Date(order.orderedAt).getTime() >= Date.now() - 90 * 86_400_000);
  const isOverstocked = projectedDemand30 > 0 && available > projectedDemand30 * 3;
  const velocity = recentUnits >= 8 ? "Fast moving" : recentUnits > soldUnits / Math.max(1, salesWindowDays / 30) ? "Trending" : recentUnits > 0 ? "Stable" : soldUnits ? "Slowing" : "Dormant";
  const healthScore = Math.max(12, Math.min(98,
    55
    + (available > variant.reorderPoint ? 18 : -18)
    + (incoming && isLow ? 12 : 0)
    + (weeklyVelocity > 0 ? 10 : -8)
    + (scorecard ? Math.round(((scorecard.qualityScore + scorecard.leadTimeScore) / 2 - 70) / 5) : 0)
    - (isDeadStock ? 20 : 0)
    - (isOverstocked ? 10 : 0),
  ));
  const status = isDeadStock ? "Dead stock" : isOverstocked ? "Overstocked" : isLow && incoming ? "Incoming covers demand" : isLow ? "Running low" : weeklyVelocity >= 2 ? "Healthy velocity" : "Healthy";
  const recommendation = isDeadStock
    ? "Discount, bundle, or archive this product before buying more."
    : isOverstocked
      ? "Do not reorder yet. Current stock exceeds projected 30-day demand."
      : isLow
        ? `Reorder ${reorderQuantity || variant.reorderQuantity || 1} unit${(reorderQuantity || variant.reorderQuantity || 1) === 1 ? "" : "s"} before available stock reaches zero.`
        : incoming
          ? "No reorder recommended. Incoming inventory is already covering current demand."
          : "No action required today. Keep monitoring sales velocity.";
  const intelligence = weeklyVelocity
    ? `${daysOfCoverage ?? "Enough"} days of projected coverage based on roughly ${weeklyVelocity.toFixed(1)} units/week.`
    : soldUnits
      ? "Sales have slowed recently. Watch before placing another supplier order."
      : "Faust is still learning demand because this SKU has no sales history yet.";

  return {
    variant,
    product,
    supplier,
    scorecard,
    balances,
    movements,
    listings,
    channelSales: Array.from(channelSales.entries()),
    onHand,
    reserved,
    incoming,
    available,
    openPurchaseOrders,
    nextEta,
    projectedDemand30,
    daysOfCoverage,
    reorderQuantity,
    healthScore,
    status,
    velocity,
    recommendation,
    intelligence,
    image: product ? productCoverImage(data, product) : undefined,
    inventoryValue: onHand * variant.landedUnitCost,
  };
}

function healthTone(score: number) {
  if (score >= 80) return "text-emerald-200 border-emerald-300/35 bg-emerald-300/10";
  if (score >= 60) return "text-[#edf3ff] border-[#8f9bb8]/45 bg-[#66708d]/15";
  if (score >= 40) return "text-amber-200 border-amber-300/35 bg-amber-300/10";
  return "text-rose-200 border-rose-300/35 bg-rose-300/10";
}

function movementLabel(type: string) {
  return type.replaceAll("_", " ");
}

function InventoryCard({ item, data }: { item: InventoryCard; data: OperatingData }) {
  return (
    <article className="faust-card overflow-hidden p-0">
      <div className="grid gap-0 xl:grid-cols-[1.2fr_1fr]">
        <div className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="h-36 w-full overflow-hidden rounded-3xl border border-slate-700/45 bg-black/35 sm:w-36">
              <ProductImage src={item.image} alt={item.product?.title || item.variant.sku} className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${healthTone(item.healthScore)}`}>{item.status}</span>
                <span className="rounded-full border border-slate-700/50 bg-black/25 px-3 py-1 text-xs text-muted-foreground">{item.velocity}</span>
              </div>
              <h3 className="mt-3 text-2xl font-semibold leading-tight">{item.product?.title || item.variant.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.variant.title}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Fact label="SKU" value={item.variant.sku} />
                <Fact label="Supplier" value={item.supplier?.name || "Unassigned"} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Metric label="On hand" value={String(item.onHand)} />
            <Metric label="Available" value={String(item.available)} detail="on hand - reserved" />
            <Metric label="Reserved" value={String(item.reserved)} detail="from orders" />
            <Metric label="Incoming" value={String(item.incoming)} detail={item.openPurchaseOrders.length ? `${item.openPurchaseOrders.length} supplier order${item.openPurchaseOrders.length === 1 ? "" : "s"}` : "none"} />
          </div>

          <section className="mt-5 rounded-3xl border border-slate-700/45 bg-black/25 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c8d2e6]">Faust inventory intelligence</p>
                <h4 className="mt-2 text-lg font-semibold">{item.recommendation}</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.intelligence}</p>
              </div>
              <div className="rounded-3xl border border-slate-700/45 bg-[#66708d]/10 px-4 py-3 text-center">
                <p className="text-3xl font-semibold tabular-nums">{item.healthScore}</p>
                <p className="text-xs text-muted-foreground">health</p>
              </div>
            </div>
          </section>

          <div className="mt-5 flex flex-wrap gap-2">
            <Action href="#inventory-actions">Receive inventory</Action>
            <Action href="#inventory-actions">Adjust inventory</Action>
            <Action href="/purchasing">Record supplier order</Action>
            <Action href="/orders">View sales</Action>
            <Action href={`/catalog/${item.variant.id}`}>Open product</Action>
          </div>
        </div>

        <div className="border-t border-slate-700/45 bg-black/20 p-5 xl:border-l xl:border-t-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <Fact label="Expected demand" value={item.projectedDemand30 ? `${item.projectedDemand30} units / 30 days` : "Learning"} />
            <Fact label="Days of coverage" value={item.daysOfCoverage === null ? "Learning" : `${item.daysOfCoverage} days`} />
            <Fact label="Reorder point" value={`${item.variant.reorderPoint} units`} />
            <Fact label="Target reorder" value={`${item.reorderQuantity || item.variant.reorderQuantity || 0} units`} />
            <Fact label="Inventory value" value={money(item.inventoryValue)} />
            <Fact label="Storage location" value={item.balances.map((balance) => data.locations.find((location) => location.id === balance.locationId)?.label || "Home storage").join(", ") || "Not set"} />
          </div>

          <section className="mt-5 rounded-3xl border border-slate-700/45 bg-black/25 p-4">
            <h4 className="font-semibold">Incoming inventory</h4>
            {item.incoming ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.incoming} units across {item.openPurchaseOrders.length || 1} supplier order{(item.openPurchaseOrders.length || 1) === 1 ? "" : "s"}{item.nextEta ? `, ETA ${new Date(item.nextEta).toLocaleDateString()}` : ""}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No inbound units are currently attached to this SKU.</p>
            )}
          </section>

          <section className="mt-5 rounded-3xl border border-slate-700/45 bg-black/25 p-4">
            <h4 className="font-semibold">Selling channels</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Depop", "eBay", "Etsy", "Mercari", "Poshmark"].map((marketplace) => {
                const sales = item.channelSales.find(([name]) => name === marketplace)?.[1] || 0;
                const listing = item.listings.find((entry) => entry.marketplace === marketplace);
                return <span key={marketplace} className="rounded-full border border-slate-700/45 bg-zinc-950/55 px-3 py-1 text-xs text-muted-foreground">{marketplace}: <b className="text-foreground">{sales}</b>{listing ? ` · ${listing.status}` : ""}</span>;
              })}
            </div>
          </section>

          <section className="mt-5 rounded-3xl border border-slate-700/45 bg-black/25 p-4">
            <h4 className="font-semibold">Inventory timeline</h4>
            <div className="mt-4 space-y-3">
              {item.movements.map((movement) => (
                <div className="relative pl-5 text-sm" key={movement.id}>
                  <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#8f9bb8] shadow-[0_0_16px_rgba(154,167,194,.55)]" />
                  <p className="font-medium capitalize">{movementLabel(movement.type)}: {movement.quantity > 0 ? "+" : ""}{movement.quantity}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{movement.note || new Date(movement.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {!item.movements.length && <p className="text-sm text-muted-foreground">No inventory movements yet. Receive or adjust stock to start the story.</p>}
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-medium text-[#edf3ff]">{value}</p></div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-3xl border border-slate-700/45 bg-zinc-950/55 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>;
}

function Action({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-2 rounded-full border border-slate-700/55 bg-[#66708d]/10 px-4 py-2 text-sm font-semibold text-[#edf3ff] transition hover:border-[#8f9bb8]/70 hover:bg-[#66708d]/20">{children}<ArrowRight size={14} /></Link>;
}

export function InventoryDetail({ data }: { data: OperatingData }) {
  const cards = activeVariants(data).map((variant) => buildInventoryCard(data, variant));
  const available = sum(cards.map((item) => item.available));
  const incoming = sum(cards.map((item) => item.incoming));
  const reserved = sum(cards.map((item) => item.reserved));
  const low = cards.filter((item) => item.status === "Running low").length;
  const awaiting = cards.filter((item) => item.incoming > 0).length;
  const needsReorder = cards.filter((item) => item.status === "Running low" && item.reorderQuantity > 0).length;
  const coverageValues = cards.map((item) => item.daysOfCoverage).filter((value): value is number => value !== null);
  const averageCoverage = coverageValues.length ? Math.round(sum(coverageValues) / coverageValues.length) : null;
  const inventoryValue = sum(cards.map((item) => item.inventoryValue));
  const fastMoving = cards.filter((item) => item.velocity === "Fast moving" || item.velocity === "Trending").length;
  const deadStock = cards.filter((item) => item.status === "Dead stock").length;

  return (
    <section className="space-y-6" aria-label="Inventory operations center">
      <div className="faust-surface overflow-hidden">
        <div className="border-b border-slate-700/45 px-5 py-5">
          <p className="text-sm font-medium text-[#edf3ff]">Inventory Operations Center</p>
          <h2 className="mt-2 text-2xl font-semibold">Know what is sellable, what is coming, and what needs action today.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            This is the single stock source of truth. Available is calculated from on-hand minus reserved, while incoming comes from supplier orders and receiving.
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Available units" value={String(available)} detail="ready to sell" />
          <Metric label="Incoming units" value={String(incoming)} detail={`${awaiting} product${awaiting === 1 ? "" : "s"} inbound`} />
          <Metric label="Reserved units" value={String(reserved)} detail="held for orders" />
          <Metric label="Inventory value" value={money(inventoryValue)} detail="landed cost basis" />
          <Metric label="Running low" value={String(low)} detail="at or below reorder point" />
          <Metric label="Need reorder" value={String(needsReorder)} detail="recommended today" />
          <Metric label="Avg coverage" value={averageCoverage === null ? "Learning" : `${averageCoverage} days`} detail="available + incoming" />
          <Metric label="Dead stock" value={String(deadStock)} detail={`${fastMoving} high velocity`} />
        </div>
        <div className="border-t border-slate-700/45 px-5 py-4">
          <div className="flex flex-wrap gap-2" aria-label="Inventory smart filters">
            {["Running low", "Incoming", "Healthy", "Overstocked", "Dead stock", "High velocity", "No sales", "Needs supplier order"].map((filter) => (
              <span key={filter} className="rounded-full border border-slate-700/45 bg-black/30 px-3 py-1 text-xs text-muted-foreground">{filter}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        {cards.map((item) => <InventoryCard key={item.variant.id} item={item} data={data} />)}
        {!cards.length && (
          <div className="faust-surface p-8 text-center">
            <PackageCheck className="mx-auto h-10 w-10 text-[#c8d2e6]" />
            <h3 className="mt-4 text-xl font-semibold">No inventory yet.</h3>
            <p className="mt-2 text-sm text-muted-foreground">Receive a purchase or import a product from the browser extension to start tracking stock.</p>
          </div>
        )}
      </div>

      <section className="faust-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#edf3ff]">Inventory signals</p>
            <h3 className="mt-2 text-xl font-semibold">What Faust is watching next</h3>
          </div>
          <div className="flex gap-2 text-[#c8d2e6]"><TrendingUp size={18} /><TrendingDown size={18} /></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <p className="rounded-3xl border border-slate-700/45 bg-black/25 p-4 text-sm text-muted-foreground">Marketplace sales reserve stock automatically before fulfillment reduces on-hand units.</p>
          <p className="rounded-3xl border border-slate-700/45 bg-black/25 p-4 text-sm text-muted-foreground">Supplier lead time, incoming units, and recent velocity drive reorder recommendations.</p>
          <p className="rounded-3xl border border-slate-700/45 bg-black/25 p-4 text-sm text-muted-foreground">Dead stock and overstock warnings appear when units sit longer than demand justifies.</p>
        </div>
      </section>
    </section>
  );
}
