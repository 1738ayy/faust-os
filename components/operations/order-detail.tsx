import type { OperatingData } from "@/domain/business";
import { money, orderProfit } from "@/lib/business-calculations";

export function OrderDetail({ data }: { data: OperatingData }) {
  return (
    <section className="space-y-5">
      {data.orders.map((order) => {
        const customer = data.customers.find((entry) => entry.id === order.customerId);
        const profit = orderProfit(order, data.variants);
        const importBatch = data.orderImportBatches?.find((batch) => batch.createdOrderIds.includes(order.id) || batch.rows.some((row) => row.orderId === order.id));
        const orderNotices = data.notices.filter((notice) => notice.category === "orders" && (notice.entityId === order.id || notice.href === "/orders"));
        const activity = data.activity.filter((entry) => entry.entityId === order.id || entry.detail.includes(order.number)).slice(0, 6);

        return (
          <article className="faust-surface overflow-hidden" key={order.id}>
            <div className="border-b border-sky-950/45 p-5">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-sky-100">{order.marketplace}</p>
                  <h2 className="mt-2 text-2xl font-semibold">{order.number} · {customer?.name || "Unmatched customer"}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{customer?.email || "No customer email on file"}</p>
                </div>
                <div className="faust-card px-4 py-3 text-right text-xs text-muted-foreground">
                  <p>Import source: {importBatch ? importBatch.filename : "Manual / connected order"}</p>
                  <p className="mt-1">Review state: {(importBatch?.status || "not required").replaceAll("_", " ")}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-3">
              <div className="faust-card p-4 text-sm">
                <b>Line lifecycle</b>
                {order.items.map((item) => (
                  <p className="mt-2 leading-6 text-muted-foreground" key={item.id}>
                    <span className="text-foreground">{item.title} x{item.quantity}</span> · {money(item.unitSellingPrice)} · COGS {money(item.unitCost)} · {item.fulfillmentState || "unfulfilled"} · refund {item.refundState || "none"} · return {item.returnState || "none"}
                  </p>
                ))}
              </div>
              <div className="faust-card p-4 text-sm">
                <b>Profit breakdown</b>
                <p className="mt-2 text-muted-foreground">Gross {money(profit.grossSales)} · discounts {money(profit.discounts)} · refunds {money(profit.refunds)}</p>
                <p className="mt-1 text-muted-foreground">COGS {money(profit.cogs)} · fees {money(profit.fees)} · shipping {money(profit.sellerShipping)}</p>
                <p className="mt-3 text-lg font-semibold text-sky-50">Contribution {money(profit.contributionProfit)}</p>
              </div>
              <div className="faust-card p-4 text-sm">
                <b>Shipment</b>
                <p className="mt-2 text-muted-foreground">Ship by {order.shipBy ? new Date(order.shipBy).toLocaleString() : "Not set"}</p>
                <p className="mt-1 text-muted-foreground">Tracking {order.trackingNumber || "Not attached"}</p>
                <p className="mt-1 text-muted-foreground">Label {order.shippingLabelUrl || "Manual / pending"}</p>
                <p className="mt-1 text-muted-foreground">Address {order.shippingAddress ? `${order.shippingAddress.line1}, ${order.shippingAddress.city}` : "Not recorded"}</p>
              </div>
            </div>

            <div className="grid gap-4 border-t border-sky-950/45 p-5 text-xs md:grid-cols-4">
              <div>
                <b>Status timeline</b>
                {(order.statusEvents || []).map((event) => <p className="mt-2 leading-5 text-muted-foreground" key={event.id}>{event.fromStatus || "Created"} to {event.toStatus} · {event.detail || ""} · {new Date(event.createdAt).toLocaleString()}</p>)}
              </div>
              <div>
                <b>Refund and return timeline</b>
                <p className="mt-2 text-muted-foreground">Refunds: {(order.refunds || []).length}</p>
                {(order.refunds || []).map((refund) => <p className="mt-1 text-muted-foreground" key={refund.id}>{money(refund.amount)} · {refund.reason}</p>)}
                <p className="mt-2 text-muted-foreground">Returns: {(order.returns || []).length}</p>
                {(order.returns || []).map((item) => <p className="mt-1 text-muted-foreground" key={item.id}>{item.status} · {item.reason}</p>)}
              </div>
              <div>
                <b>Notifications</b>
                {orderNotices.map((notice) => <p className="mt-2 leading-5 text-muted-foreground" key={notice.id}>{notice.resolved ? "Resolved" : "Open"} · {notice.title}</p>)}
                {!orderNotices.length && <p className="mt-2 text-muted-foreground">No linked notifications.</p>}
              </div>
              <div>
                <b>Activity trail</b>
                {activity.map((entry) => <p className="mt-2 leading-5 text-muted-foreground" key={entry.id}>{entry.action} · {entry.detail}</p>)}
                {!activity.length && <p className="mt-2 text-muted-foreground">No activity yet.</p>}
              </div>
            </div>

            <div className="border-t border-sky-950/45 p-5 text-xs text-muted-foreground">
              <b className="text-foreground">Notes and tags:</b> {order.notes || "None"} {order.tags?.length ? `· Tags: ${order.tags.join(", ")}` : ""}
            </div>
          </article>
        );
      })}
    </section>
  );
}
