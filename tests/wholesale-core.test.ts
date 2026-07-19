import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { allocateOrderItemFifo, assertBalancedJournals, processWholesaleOutbox, receiveWholesalePurchaseBatch, receiveWholesaleReturn, syncChannelInventoryRisk, wholesaleCoreSummary } from "../lib/wholesale-core";

const fixture = (): OperatingData => {
  const time = new Date().toISOString();
  const supplierId = crypto.randomUUID(), productId = crypto.randomUUID(), variantId = crypto.randomUUID(), locationId = crypto.randomUUID(), customerId = crypto.randomUUID(), listingId = crypto.randomUUID(), orderId = crypto.randomUUID(), orderItemId = crypto.randomUUID(), poId = crypto.randomUUID();
  return {
    version: 1, mode: "local", updatedAt: time,
    suppliers: [{ id: supplierId, name: "Test supplier", sourcePlatform: "Superbuy", status: "active" }],
    products: [{ id: productId, title: "Test hoodie", category: "Streetwear", tags: [], supplierId, status: "active", createdAt: time, updatedAt: time }],
    variants: [{ id: variantId, productId, sku: "FST-HOOD-001", title: "Charcoal / L", condition: "New", landedUnitCost: 31.7, defaultSalePrice: 86, reorderPoint: 2, reorderQuantity: 8, active: true }],
    locations: [{ id: locationId, label: "VA-01 / A / 04 / 03", warehouse: "Virginia" }],
    balances: [], stockMovements: [],
    purchaseOrders: [{ id: poId, supplierId, reference: "PO-1", status: "ordered", orderedAt: time, totalCost: 0, itemCount: 0, items: [] }],
    parcels: [],
    listings: [{ id: listingId, variantId, marketplace: "Depop", title: "Test hoodie", price: 86, quantity: 2, status: "active", syncState: "manual", createdAt: time }],
    customers: [{ id: customerId, name: "Test customer", orderCount: 1, lifetimeValue: 86, issueCount: 0 }],
    orders: [{ id: orderId, number: "FO-1042", marketplace: "Depop", customerId, items: [{ id: orderItemId, productId, variantId, listingId, title: "Test hoodie", quantity: 1, unitSellingPrice: 86, discountAllocation: 0, taxAllocation: 0, feeAllocation: 0, unitCost: 0 }], shippingCharged: 0, shippingCost: 0, marketplaceFee: 0, paymentFee: 0, taxCollected: 0, status: "paid", orderedAt: time }],
    transactions: [], tasks: [], notices: [], insights: [], activity: [],
  };
};

test("wholesale core receives RMB batches, allocates FIFO costs, records returns, and balances journals", () => {
  const data = fixture();
  const variant = data.variants[0];
  const order = data.orders[0];
  const item = order.items[0];
  const listing = data.listings[0];
  const batchKey = crypto.randomUUID();

  receiveWholesalePurchaseBatch(data, {
    reference: "CN-WHOLESALE-001",
    supplierId: data.suppliers[0].id,
    purchaseOrderId: data.purchaseOrders[0].id,
    currency: "RMB",
    rmbUsdRate: 0.14,
    items: [{ variantId: variant.id, quantity: 5, unitCost: 120, weightOz: 20, physicalSku: "PHY-HOOD-L", locationId: data.locations[0].id }],
    landedCosts: [
      { type: "international_freight", description: "Forwarder freight", amount: 80, currency: "RMB", allocationMethod: "by_quantity" },
      { type: "duty", description: "Customs duty", amount: 6, currency: "USD", allocationMethod: "by_value" },
    ],
    idempotencyKey: batchKey,
  });
  receiveWholesalePurchaseBatch(data, {
    reference: "CN-WHOLESALE-001",
    currency: "RMB",
    rmbUsdRate: 0.14,
    items: [{ variantId: variant.id, quantity: 5, unitCost: 120 }],
    landedCosts: [],
    idempotencyKey: batchKey,
  });

  assert.equal(data.purchaseBatches?.length, 1);
  assert.equal(data.exchangeRates?.[0].rate, 0.14);
  assert.equal(data.inventoryLots?.[0].quantityRemaining, 5);
  assert.equal(data.landedCostComponents?.length, 2);

  const fifoKey = crypto.randomUUID();
  allocateOrderItemFifo(data, { orderId: order.id, orderItemId: item.id, idempotencyKey: fifoKey });
  allocateOrderItemFifo(data, { orderId: order.id, orderItemId: item.id, idempotencyKey: fifoKey });
  assert.equal(data.orderItemCostAllocations?.length, 1);
  assert.equal(data.inventoryLots?.[0].quantityRemaining, 4);
  assert.ok(order.items[0].unitCost > 0);

  receiveWholesaleReturn(data, { orderId: order.id, orderItemId: item.id, quantity: 1, returnId: crypto.randomUUID(), mode: "original_lot", idempotencyKey: crypto.randomUUID() });
  assert.equal(data.inventoryLots?.[0].quantityRemaining, 5);
  receiveWholesaleReturn(data, { orderId: order.id, orderItemId: item.id, quantity: 1, returnId: crypto.randomUUID(), mode: "returned_goods_lot", idempotencyKey: crypto.randomUUID() });
  assert.ok(data.inventoryLots?.some((lot) => lot.condition === "returned_goods"));

  syncChannelInventoryRisk(data, { variantId: variant.id, listingId: listing.id, desiredQuantity: 99, physicalSku: "PHY-HOOD-L", idempotencyKey: crypto.randomUUID() });
  assert.equal(data.channelSyncStates?.[0].risk, "oversell");
  assert.equal(data.inventoryRiskLocks?.[0].status, "active");
  assert.equal(data.physicalSkuMappings?.[0].physicalSku, "PHY-HOOD-L");

  processWholesaleOutbox(data, { maxAttempts: 1 });
  assert.ok(data.deadLetters?.length);
  assertBalancedJournals(data);
  const summary = wholesaleCoreSummary(data);
  assert.equal(summary.purchaseBatches, 1);
  assert.ok(summary.journalEntries >= 3);
});
