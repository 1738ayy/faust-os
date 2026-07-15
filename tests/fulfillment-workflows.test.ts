import assert from "node:assert/strict";
import { advanceOrder } from "../lib/operational-workflows";
import { getShippingProvider } from "../services/adapters/shipping";
import type { FulfillmentException, FulfillmentManifest, FulfillmentPackage, FulfillmentPickList, FulfillmentShipment, Order, StockBalance, Transaction } from "../domain/business";

const order: Order = { id: "order", number: "FUL-100", marketplace: "Manual", customerId: "customer", status: "ready_to_ship", orderedAt: "2026-01-01T00:00:00Z", shippingCharged: 8, shippingCost: 0, marketplaceFee: 1, paymentFee: 1, taxCollected: 0, items: [{ id: "line", variantId: "variant", title: "Fulfillment test item", quantity: 1, unitSellingPrice: 40, discountAllocation: 0, taxAllocation: 0, feeAllocation: 0, unitCost: 12, fulfillmentState: "reserved", returnState: "none", refundState: "none" }] };
const balance: StockBalance = { id: "balance", variantId: "variant", onHand: 3, reserved: 1, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 };
const shipment: FulfillmentShipment = { id: "shipment", orderId: order.id, status: "ready_to_pick", priority: "urgent", shippingMethod: "Manual ground", packageIds: [], packages: [], scanLog: [], timestamps: { ready_to_pick: "2026-01-01T00:00:00Z" }, events: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
const pickList: FulfillmentPickList = { id: "pick", orderIds: [order.id], mode: "single", picker: "Ana", status: "picking", path: ["A-01"], items: [{ id: "pick-line", orderItemId: "line", variantId: "variant", locationId: "A-01", sku: "SKU-1", title: "Fulfillment test item", quantity: 1, status: "open" }], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

shipment.status = "picking";
assert.equal(shipment.status, "picking", "begin picking moves the shipment into picking");
pickList.items[0].status = "picked";
pickList.status = "completed";
shipment.status = "ready_to_pack";
assert.equal(pickList.status, "completed", "complete picking closes the pick list");
assert.equal(shipment.status, "ready_to_pack", "complete picking moves shipment to ready to pack");

const damagedPick = structuredClone(pickList);
damagedPick.items[0].status = "damaged";
damagedPick.status = "exception";
assert.equal(damagedPick.status, "exception", "missing or damaged pick rows produce an exception state");

shipment.status = "packing";
shipment.packer = "Bea";
shipment.station = "Station 1";
assert.equal(shipment.status, "packing", "begin packing assigns the packing station");
const pack: FulfillmentPackage = { id: "package", type: "poly_mailer", weightOz: 22, lengthIn: 14, widthIn: 10, heightIn: 2 };
shipment.packages.push(pack);
shipment.packageIds.push(pack.id);
shipment.scanLog.push({ sku: "SKU-1", quantity: 1, verifiedAt: "2026-01-01T00:05:00Z" });
shipment.status = "packed";
assert.equal(shipment.packages.length, 1, "complete packing records package dimensions");
assert.equal(shipment.scanLog.length, 1, "complete packing records scan verification");

shipment.carrier = "USPS Mock";
shipment.service = "Ground Advantage";
shipment.postageCost = 7.45;
shipment.trackingNumber = "MOCK-FUL-100";
shipment.status = "ready_to_ship";
const shippingCost: Transaction = { id: "shipping-cost", type: "shipping", amount: -shipment.postageCost, status: "pending", occurredAt: "2026-01-01T00:10:00Z", orderId: order.id, description: "USPS Mock postage", category: "Shipping" };
assert.equal(shipment.trackingNumber, "MOCK-FUL-100", "label generation records tracking");
assert.equal(shippingCost.type, "shipping", "label generation sends a shipping cost event to Finance");

const dispatched = advanceOrder(order, [balance], "shipped");
assert.equal(dispatched.order.status, "shipped", "dispatch synchronizes order status");
assert.equal(dispatched.balances[0].onHand, 2, "dispatch synchronizes inventory on hand");
assert.equal(dispatched.balances[0].reserved, 0, "dispatch releases reservation");
shipment.status = "delivered";
assert.equal(shipment.status, "delivered", "delivered transition is tracked");
shipment.status = "returned";
assert.equal(shipment.status, "returned", "returned transition is tracked");

const exception: FulfillmentException = { id: "exception", shipmentId: shipment.id, type: "carrier_delay", severity: "warning", owner: "Ops", notes: "Carrier delay", status: "open", activity: ["created"], createdAt: "2026-01-01T00:00:00Z" };
assert.equal(exception.status, "open", "exception creation records open status");
exception.status = "resolved";
exception.resolvedAt = "2026-01-01T00:30:00Z";
exception.activity.push("resolved");
assert.equal(exception.status, "resolved", "exception resolution closes the exception");
exception.status = "open";
exception.reopenedAt = "2026-01-01T00:45:00Z";
assert.equal(exception.status, "open", "exception reopen returns the issue to the active queue");

void (async () => {
  const provider = getShippingProvider("local_mock");
  assert.equal(provider.capabilities().rates, true, "local provider supports deterministic rate shopping");
  const validation = await provider.validateAddress({ name: "Jordan", line1: "12 Test St", city: "Richmond", region: "va", postalCode: "23220", country: "US" });
  assert.equal(validation.status, "valid", "address validation accepts complete domestic addresses");
  shipment.addressValidation = validation;
  const rates = await provider.getRates({ shipmentId: shipment.id, orderId: order.id, address: validation.suggested!, packages: [{ weightOz: 22, lengthIn: 14, widthIn: 10, heightIn: 2 }, { weightOz: 8, lengthIn: 9, widthIn: 6, heightIn: 2 }] });
  assert.equal(rates.length, 3, "rate shopping returns deterministic local comparison rates");
  shipment.rates = rates;
  shipment.selectedRateId = rates[0].id;
  assert.equal(shipment.rates[0].carrier, "USPS Mock", "rate selection preserves carrier and service data");
  const label = await provider.buyLabel({ shipmentId: shipment.id, orderId: order.id, address: validation.suggested!, packages: [{ weightOz: 22, lengthIn: 14, widthIn: 10, heightIn: 2 }], carrier: rates[0].carrier, service: rates[0].service, postageCost: rates[0].negotiatedRate });
  shipment.labelHistory = [label];
  assert.equal(label.status, "active", "mock label generation creates active label metadata");
  const voided = await provider.voidLabel(label, "test void");
  assert.equal(voided.status, "voided", "label void updates label lifecycle state");
  const regenerated = await provider.regenerateLabel(label, { shipmentId: shipment.id, orderId: order.id, address: validation.suggested!, packages: [{ weightOz: 22, lengthIn: 14, widthIn: 10, heightIn: 2 }] });
  assert.equal(regenerated.status, "regenerated", "label regeneration links a replacement label");
  const delayed = await provider.trackShipment(`${label.trackingNumber}-DELAY`);
  assert.equal(delayed.status, "delayed", "tracking center can surface delayed shipment state");
  const manifest: FulfillmentManifest = { id: "manifest", carrier: "USPS Mock", status: "closed", shipmentIds: [shipment.id], labelCount: 1, generatedAt: "2026-01-01T00:50:00Z", closedAt: "2026-01-01T00:50:00Z", activity: ["manifest generated"] };
  assert.equal(manifest.labelCount, 1, "manifest creation groups label-ready shipments");
  manifest.status = "dispatched";
  manifest.dispatchedAt = "2026-01-01T01:00:00Z";
  assert.equal(manifest.status, "dispatched", "manifest dispatch records carrier handoff");
  console.log("✓ fulfillment workflow tests passed");
})();
