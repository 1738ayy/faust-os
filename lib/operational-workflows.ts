import type { Order, OrderStatus, Parcel, PurchaseOrder, StockBalance, StockMovement } from "@/domain/business";
import { availableUnits } from "./business-calculations";

const transitions: Record<Exclude<OrderStatus, "inventory_reserved" | "label_purchased">, OrderStatus[]> = {
  draft: ["pending_payment", "cancelled"], pending_payment: ["paid", "cancelled"], paid: ["confirmed", "reserved", "cancelled"], confirmed: ["reserved", "cancelled"], reserved: ["ready_to_pack", "cancelled"], ready_to_pack: ["packed", "cancelled"], packed: ["label_created", "cancelled"], label_created: ["ready_to_ship", "cancelled"], ready_to_ship: ["shipped", "cancelled"], shipped: ["in_transit", "return_requested"], in_transit: ["delivered"], delivered: ["closed", "return_requested"], closed: [], cancelled: [], return_requested: ["return_in_transit"], return_in_transit: ["returned"], returned: ["partially_refunded", "refunded"], partially_refunded: ["refunded"], refunded: [],
};
const canonicalStatus = (status: OrderStatus): Exclude<OrderStatus, "inventory_reserved" | "label_purchased"> => status === "inventory_reserved" ? "reserved" : status === "label_purchased" ? "label_created" : status;
const reservedStatuses: OrderStatus[] = ["reserved", "inventory_reserved", "ready_to_pack", "packed", "label_created", "label_purchased", "ready_to_ship"];
type NewMovement = Omit<StockMovement, "id" | "createdAt">;

function balanceFor(balances: StockBalance[], variantId: string) {
  const balance = balances.find((entry) => entry.variantId === variantId);
  if (!balance) throw new Error(`No inventory balance exists for variant ${variantId}.`);
  return balance;
}

export function advanceOrder(order: Order, balances: StockBalance[], next: OrderStatus) {
  const current = canonicalStatus(order.status); const target = canonicalStatus(next);
  if (!transitions[current].map(canonicalStatus).includes(target)) throw new Error(`Cannot move an order from ${order.status} to ${next}.`);
  if (!order.items.length) throw new Error("An order must contain at least one line item.");
  const updatedBalances = balances.map((entry) => ({ ...entry }));
  const movements: NewMovement[] = [];
  if (target === "reserved") {
    for (const item of order.items) {
      const balance = balanceFor(updatedBalances, item.variantId);
      if (availableUnits(balance) < item.quantity) throw new Error(`Insufficient available inventory for ${item.title}.`);
    }
    for (const item of order.items) {
      const balance = balanceFor(updatedBalances, item.variantId);
      balance.reserved += item.quantity;
      movements.push({ variantId: item.variantId, quantity: -item.quantity, reservedDelta: item.quantity, onHandDelta: 0, type: "order_reservation", referenceType: "order", referenceId: order.id });
    }
  }
  if (target === "cancelled" && reservedStatuses.includes(order.status)) {
    for (const item of order.items) {
      const balance = balanceFor(updatedBalances, item.variantId);
      if (balance.reserved < item.quantity) throw new Error(`Inventory reservation for ${item.title} cannot be released safely.`);
    }
    for (const item of order.items) {
      const balance = balanceFor(updatedBalances, item.variantId);
      balance.reserved -= item.quantity;
      movements.push({ variantId: item.variantId, quantity: item.quantity, reservedDelta: -item.quantity, onHandDelta: 0, type: "order_cancellation", referenceType: "order", referenceId: order.id });
    }
  }
  if (target === "shipped") {
    for (const item of order.items) {
      const balance = balanceFor(updatedBalances, item.variantId);
      if (balance.reserved < item.quantity || balance.onHand < item.quantity) throw new Error(`Cannot ship ${item.title} without reserved physical inventory.`);
    }
    for (const item of order.items) {
      const balance = balanceFor(updatedBalances, item.variantId);
      balance.reserved -= item.quantity;
      balance.onHand -= item.quantity;
      movements.push({ variantId: item.variantId, quantity: -item.quantity, reservedDelta: -item.quantity, onHandDelta: -item.quantity, type: "sale", referenceType: "order", referenceId: order.id });
    }
  }
  return { order: { ...order, status: target, statusEvents: [...(order.statusEvents || []), { id: crypto.randomUUID(), fromStatus: order.status, toStatus: target, createdAt: new Date().toISOString() }] }, balances: updatedBalances, movements };
}

export function cancelOrderItems(order: Order, balances: StockBalance[], cancellations: { itemId: string; quantity: number }[], reason: string) {
  if (!reservedStatuses.includes(order.status)) throw new Error("Only reserved, unshipped orders can be partially cancelled.");
  if (!cancellations.length) throw new Error("Choose at least one line item to cancel.");
  const updatedItems = order.items.map((item) => ({ ...item })); const updatedBalances = balances.map((balance) => ({ ...balance })); const movements: NewMovement[] = [];
  for (const cancellation of cancellations) { const item = updatedItems.find((entry) => entry.id === cancellation.itemId); if (!item || !Number.isInteger(cancellation.quantity) || cancellation.quantity <= 0 || cancellation.quantity > item.quantity - (item.cancelledQuantity || 0)) throw new Error("Invalid partial cancellation quantity."); const balance = balanceFor(updatedBalances, item.variantId); if (balance.reserved < cancellation.quantity) throw new Error("Reservation is inconsistent and cannot be partially released."); }
  for (const cancellation of cancellations) { const item = updatedItems.find((entry) => entry.id === cancellation.itemId)!; const balance = balanceFor(updatedBalances, item.variantId); item.cancelledQuantity = (item.cancelledQuantity || 0) + cancellation.quantity; item.fulfillmentState = item.cancelledQuantity === item.quantity ? "cancelled" : item.fulfillmentState; balance.reserved -= cancellation.quantity; movements.push({ variantId: item.variantId, quantity: cancellation.quantity, reservedDelta: -cancellation.quantity, onHandDelta: 0, type: "order_cancellation", referenceType: "order", referenceId: order.id, note: reason }); }
  return { order: { ...order, items: updatedItems, statusEvents: [...(order.statusEvents || []), { id: crypto.randomUUID(), fromStatus: order.status, toStatus: order.status, detail: reason, createdAt: new Date().toISOString() }] }, balances: updatedBalances, movements };
}

export function createOrderRefund(order: Order, input: { amount: number; reason: string; itemId?: string; quantity?: number; shippingAmount?: number; feeAdjustment?: number; externalRefundId?: string }) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Refund amount must be positive."); const alreadyRefunded = (order.refunds || []).reduce((sum, refund) => sum + refund.amount, 0); const gross = order.items.reduce((sum, item) => sum + item.unitSellingPrice * item.quantity - item.discountAllocation, 0) + order.shippingCharged; if (alreadyRefunded + input.amount > gross + 0.001) throw new Error("Refund exceeds the refundable order amount."); const items = order.items.map((item) => ({ ...item })); if (input.itemId) { const item = items.find((entry) => entry.id === input.itemId); if (!item || !input.quantity || input.quantity <= 0 || input.quantity + (item.refundedQuantity || 0) > item.quantity - (item.cancelledQuantity || 0)) throw new Error("Invalid line-item refund quantity."); item.refundedQuantity = (item.refundedQuantity || 0) + input.quantity; item.refundState = item.refundedQuantity === item.quantity ? "refunded" : "partial"; }
  const refund = { id: crypto.randomUUID(), amount: input.amount, reason: input.reason, refundedAt: new Date().toISOString(), externalRefundId: input.externalRefundId, itemId: input.itemId, shippingAmount: input.shippingAmount, feeAdjustment: input.feeAdjustment };
  const total = alreadyRefunded + input.amount; const nextStatus: OrderStatus = total >= gross - 0.001 ? "refunded" : "partially_refunded"; return { order: { ...order, items, refunds: [...(order.refunds || []), refund], status: nextStatus, statusEvents: [...(order.statusEvents || []), { id: crypto.randomUUID(), fromStatus: order.status, toStatus: nextStatus, detail: input.reason, createdAt: new Date().toISOString() }] }, refund };
}

export function receiveOrderReturn(order: Order, balances: StockBalance[], returnId: string, dispositions: { itemId: string; quantity: number; disposition: "available" | "damaged" | "quarantine" }[]) {
  const returnRecord = (order.returns || []).find((entry) => entry.id === returnId); if (!returnRecord || !["approved", "in_transit", "requested"].includes(returnRecord.status)) throw new Error("Return cannot be received in its current state."); const updatedBalances = balances.map((balance) => ({ ...balance })); const items = order.items.map((item) => ({ ...item })); const movements: NewMovement[] = [];
  for (const disposition of dispositions) { const item = items.find((entry) => entry.id === disposition.itemId); if (!item || !Number.isInteger(disposition.quantity) || disposition.quantity <= 0) throw new Error("Invalid returned item quantity."); const requested = returnRecord.items.find((entry) => entry.orderItemId === item.id); if (!requested || disposition.quantity + (item.returnedQuantity || 0) > requested.quantity) throw new Error("Return quantity exceeds the approved return."); const balance = balanceFor(updatedBalances, item.variantId); item.returnedQuantity = (item.returnedQuantity || 0) + disposition.quantity; item.returnState = "received"; if (disposition.disposition === "available") balance.onHand += disposition.quantity; else if (disposition.disposition === "damaged") { balance.onHand += disposition.quantity; balance.damaged += disposition.quantity; } else { balance.onHand += disposition.quantity; balance.quarantined += disposition.quantity; } movements.push({ variantId: item.variantId, quantity: disposition.quantity, onHandDelta: disposition.quantity, reservedDelta: 0, type: "return", referenceType: "return", referenceId: returnId, note: disposition.disposition }); }
  const returns = (order.returns || []).map((entry) => entry.id === returnId ? { ...entry, status: "received" as const, receivedAt: new Date().toISOString(), items: entry.items.map((item) => ({ ...item, disposition: dispositions.find((entry) => entry.itemId === item.orderItemId)?.disposition || item.disposition })) } : entry); return { order: { ...order, items, returns, status: "returned" as const, statusEvents: [...(order.statusEvents || []), { id: crypto.randomUUID(), fromStatus: order.status, toStatus: "returned", createdAt: new Date().toISOString() }] }, balances: updatedBalances, movements };
}

export type ReceiptInput = { parcelItemId: string; receivedQuantity: number; damagedQuantity?: number; missingQuantity?: number; rejectedQuantity?: number; overageQuantity?: number; locationId?: string };

export function receiveParcelItems(parcel: Parcel, purchaseOrder: PurchaseOrder | undefined, balances: StockBalance[], receipts?: ReceiptInput[]) {
  if (parcel.status === "delivered") throw new Error("This parcel has already been received.");
  if (!parcel.items.length) throw new Error("This parcel has no item rows.");
  const updatedBalances = balances.map((balance) => ({ ...balance }));
  const updatedParcel: Parcel = { ...parcel, items: parcel.items.map((item) => ({ ...item })), events: [...parcel.events] };
  const updatedPo = purchaseOrder ? { ...purchaseOrder, items: purchaseOrder.items.map((item) => ({ ...item })) } : undefined;
  const movements: NewMovement[] = [];
  for (const item of updatedParcel.items) {
    const input = receipts?.find((entry) => entry.parcelItemId === item.id);
    const remaining = item.expectedQuantity - item.receivedQuantity;
    const received = input ? input.receivedQuantity : remaining;
    const damaged = input?.damagedQuantity || 0;
    const missing = input?.missingQuantity || 0;
    const rejected = input?.rejectedQuantity || 0;
    const overage = input?.overageQuantity || 0;
    if (![received, damaged, missing, rejected, overage].every(Number.isInteger) || [received, damaged, missing, rejected, overage].some((value) => value < 0)) throw new Error("Receipt quantities must be non-negative whole numbers.");
    if (received + damaged + missing + rejected > remaining) throw new Error("Receipt quantities exceed the remaining expected quantity.");
    if (!input && remaining <= 0) continue;
    const balance = balanceFor(updatedBalances, item.variantId);
    const arriving = received + damaged + rejected + missing;
    if (balance.incoming < arriving) throw new Error("Incoming quantity is inconsistent and cannot be received safely.");
    balance.incoming -= arriving;
    balance.onHand += received + overage;
    balance.damaged += damaged;
    item.receivedQuantity += received + damaged + rejected + missing;
    const poItem = updatedPo?.items.find((entry) => entry.id === item.purchaseOrderItemId);
    if (poItem) poItem.receivedQuantity += received + damaged + rejected + missing;
    if (received || overage) movements.push({ variantId: item.variantId, quantity: received + overage, onHandDelta: received + overage, reservedDelta: 0, type: "purchase_received", referenceType: "parcel", referenceId: parcel.id, destinationLocationId: input?.locationId });
    if (damaged) movements.push({ variantId: item.variantId, quantity: damaged, onHandDelta: 0, reservedDelta: 0, type: "damage", referenceType: "parcel", referenceId: parcel.id, destinationLocationId: input?.locationId });
  }
  const allReceived = updatedParcel.items.every((item) => item.receivedQuantity >= item.expectedQuantity);
  updatedParcel.status = allReceived ? "delivered" : "warehouse";
  updatedParcel.events.unshift({ label: allReceived ? "Receiving complete" : "Partial receipt recorded", timestamp: new Date().toISOString(), location: updatedParcel.destination });
  if (updatedPo) updatedPo.status = updatedPo.items.every((item) => item.receivedQuantity >= item.expectedQuantity) ? "received" : "partial";
  return { parcel: updatedParcel, purchaseOrder: updatedPo, balances: updatedBalances, movements };
}
