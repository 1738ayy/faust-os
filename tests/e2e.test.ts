import assert from "node:assert/strict";
import { advanceOrder, receiveParcelItems } from "../lib/operational-workflows";
import type { Order, Parcel, PurchaseOrder, StockBalance } from "../domain/business";

const balance: StockBalance = { id: "stock", variantId: "variant", onHand: 0, reserved: 0, incoming: 2, damaged: 0, returned: 0, lost: 0, quarantined: 0 };
const po: PurchaseOrder = { id: "po", supplierId: "supplier", reference: "PO-E2E", status: "ordered", orderedAt: "2026-01-01T00:00:00Z", totalCost: 20, itemCount: 2, items: [{ id: "po-line", variantId: "variant", expectedQuantity: 2, receivedQuantity: 0, unitCost: 10 }] };
const parcel: Parcel = { id: "parcel", trackingNumber: "TRACK-E2E", status: "in_transit", purchaseOrderId: po.id, items: [{ id: "parcel-line", variantId: "variant", purchaseOrderItemId: "po-line", expectedQuantity: 2, receivedQuantity: 0 }], events: [] };
const receipt = receiveParcelItems(parcel, po, [balance]);
const order: Order = { id: "order", number: "ORDER-E2E", marketplace: "Manual", customerId: "customer", items: [{ id: "order-line", variantId: "variant", title: "Imported product", quantity: 1, unitSellingPrice: 30, discountAllocation: 0, taxAllocation: 0, feeAllocation: 0, unitCost: 10 }], shippingCharged: 0, shippingCost: 4, marketplaceFee: 3, paymentFee: 1, taxCollected: 0, status: "paid", orderedAt: "2026-01-01T00:00:00Z" };
const reserved = advanceOrder(order, receipt.balances, "inventory_reserved");
const packed: Order = { ...reserved.order, status: "ready_to_ship" };
const shipped = advanceOrder(packed, reserved.balances, "shipped");
assert.equal(shipped.balances[0].onHand, 1, "source-to-sale journey receives then ships the reserved unit");
const cancelled = advanceOrder(reserved.order, reserved.balances, "cancelled");
assert.equal(cancelled.balances[0].reserved, 0, "cancellation journey releases inventory");
console.log("✓ source-to-sale and cancellation journey tests passed");
