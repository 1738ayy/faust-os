import type { OperatingData } from "@/domain/business";
import { availableUnits } from "@/lib/business-calculations";
import { activeVariants } from "@/lib/product-state";

export function InventoryDetail({ data }: { data: OperatingData }) {
  const inventoryActivity = data.activity.filter((event) => event.entityType === "inventory_balance").slice(0, 12);

  return (
    <section className="faust-surface overflow-hidden" aria-label="Inventory detail">
      <div className="border-b border-slate-700/45 px-5 py-5">
        <p className="text-sm font-medium text-[#edf3ff]">Stock detail and movement history</p>
        <h2 className="mt-2 text-2xl font-semibold">Every unit is tied to a location and an audit trail.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Use this view to see what can sell, what is reserved, what is incoming, and which products need a physical stock check.
        </p>
      </div>

      <div className="divide-y divide-slate-700/35">
        {activeVariants(data).map((variant) => {
          const balances = data.balances.filter((balance) => balance.variantId === variant.id);
          const product = data.products.find((entry) => entry.id === variant.productId);
          const supplier = data.suppliers.find((entry) => entry.id === product?.supplierId);
          const purchaseOrders = data.purchaseOrders.filter((entry) => entry.items.some((item) => item.variantId === variant.id));
          const listings = data.listings.filter((entry) => entry.variantId === variant.id);
          const orders = data.orders.filter((entry) => entry.items.some((item) => item.variantId === variant.id));
          const movements = data.stockMovements.filter((movement) => movement.variantId === variant.id).slice(0, 5);
          const totalAvailable = balances.reduce((sum, balance) => sum + availableUnits(balance), 0);
          const totalIncoming = balances.reduce((sum, balance) => sum + balance.incoming, 0);

          return (
            <article className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.25fr_1fr]" key={variant.id}>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">SKU</p>
                <h3 className="mt-2 text-xl font-semibold">{variant.sku}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{variant.title}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="faust-card p-3">
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{totalAvailable}</p>
                  </div>
                  <div className="faust-card p-3">
                    <p className="text-xs text-muted-foreground">Incoming</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{totalIncoming}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Supplier: <span className="text-foreground">{supplier?.name || "Unassigned"}</span></p>
                <p className="mt-1 text-sm text-muted-foreground">Reorder: <span className="text-foreground">{variant.reorderPoint}</span> threshold / <span className="text-foreground">{variant.reorderQuantity}</span> suggested</p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Linked to {purchaseOrders.length} purchase order(s), {listings.length} listing(s), and {orders.length} order(s).
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Balances by location</h4>
                <div className="mt-3 grid gap-3">
                  {balances.map((balance) => (
                    <div className="faust-card p-4" key={balance.id}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <b>{data.locations.find((location) => location.id === balance.locationId)?.label || "Unassigned"}</b>
                        <span className="rounded-full border border-slate-700/45 bg-[#66708d]/10 px-2.5 py-1 text-xs text-[#f6f8ff]">
                          {availableUnits(balance)} available
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        On hand {balance.onHand} · reserved {balance.reserved} · incoming {balance.incoming}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Damaged {balance.damaged} · quarantine {balance.quarantined} · lost {balance.lost}
                      </p>
                    </div>
                  ))}
                  {!balances.length && <p className="faust-card p-4 text-sm text-muted-foreground">No stock has been received for this SKU yet.</p>}
                </div>
              </div>

              <div>
                <h4 className="font-semibold">Movement history</h4>
                <div className="mt-3 space-y-3">
                  {movements.map((movement) => (
                    <div className="relative pl-5 text-sm" key={movement.id}>
                      <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#8f9bb8] shadow-[0_0_16px_rgba(154,167,194,.55)]" />
                      <p className="font-medium capitalize">{movement.type.replaceAll("_", " ")}: {movement.quantity > 0 ? "+" : ""}{movement.quantity}</p>
                      {movement.note && <p className="mt-1 text-xs leading-5 text-muted-foreground">{movement.note}</p>}
                    </div>
                  ))}
                  {!movements.length && <p className="text-sm text-muted-foreground">No stock movements yet.</p>}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="border-t border-slate-700/45 px-5 py-5">
        <h3 className="font-semibold">Activity history</h3>
        <div className="mt-3 space-y-3">
          {inventoryActivity.map((event) => (
            <p className="text-sm text-muted-foreground" key={event.id}>
              <b className="text-foreground">{event.action}</b> — {event.detail || "No detail provided."} — {new Date(event.createdAt).toLocaleString()}
            </p>
          ))}
          {!inventoryActivity.length && <p className="text-sm text-muted-foreground">Inventory actions will appear here after the first movement.</p>}
        </div>
      </div>
    </section>
  );
}
