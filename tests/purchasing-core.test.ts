import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { approvePurchaseOrder, create1688PurchaseOrder, generateReorderRecommendations, receivePurchaseParcelToLots, recordPurchasePayment, seedSupplierOperations, purchasingSummary } from "../lib/purchasing-core";

const fixture = (): OperatingData => {
  const time = new Date().toISOString();
  const supplierId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const balanceId = crypto.randomUUID();
  const locationId = crypto.randomUUID();
  return {
    version: 1, mode: "local", updatedAt: time,
    products: [{ id: productId, title: "1688 heavy hoodie", category: "Streetwear", tags: ["hoodie"], image: "/hoodie.png", supplierId, status: "active", createdAt: time, updatedAt: time }],
    variants: [{ id: variantId, productId, sku: "FST-1688-HOOD-L", title: "Charcoal / L", condition: "New with tags", landedUnitCost: 18.5, defaultSalePrice: 82, reorderPoint: 3, reorderQuantity: 9, active: true }],
    locations: [{ id: locationId, label: "A1", warehouse: "Main", zone: "A", bin: "1" }],
    balances: [{ id: balanceId, variantId, locationId, onHand: 1, reserved: 0, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 }],
    stockMovements: [],
    suppliers: [{ id: supplierId, name: "Hangzhou 1688 Factory", sourcePlatform: "1688", status: "active", leadDays: 10, contact: "Lin", email: "lin@example.test" }],
    purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [],
  };
};

test("purchasing core runs 1688 PO, payment, receiving, supplier claim, lots, and reorder planning workflows", () => {
  const data = fixture();
  seedSupplierOperations(data);
  assert.equal(data.supplierContacts?.length, 1);
  assert.equal(data.supplierScorecards?.length, 1);

  create1688PurchaseOrder(data, {
    supplierId: data.suppliers[0].id,
    reference: "1688-TEST-001",
    currency: "RMB",
    exchangeRate: 0.14,
    domesticFreight: 40,
    internationalFreight: 30,
    duties: 7,
    customs: 3,
    items: [{ variantId: data.variants[0].id, expectedQuantity: 6, unitCost: 100 }],
    idempotencyKey: crypto.randomUUID(),
  });

  const po = data.purchaseOrders[0];
  assert.equal(po.status, "draft");
  assert.equal(data.purchaseApprovals?.[0].status, "requested");
  assert.ok(data.transactions.some((entry) => entry.category === "Purchase commitment" && entry.purchaseOrderId === po.id));
  assert.equal(data.supplierPriceHistory?.length, 1);
  assert.equal(data.freightConsolidations?.length, 1);

  approvePurchaseOrder(data, po.id, true, "Approved for replenishment");
  assert.equal(po.status, "ordered");
  assert.equal(data.purchaseApprovals?.[0].status, "approved");

  recordPurchasePayment(data, { purchaseOrderId: po.id, type: "deposit", currency: "RMB", amountOriginal: 300, exchangeRate: 0.14, idempotencyKey: crypto.randomUUID() });
  recordPurchasePayment(data, { purchaseOrderId: po.id, type: "final", currency: "RMB", amountOriginal: 360, exchangeRate: 0.14, idempotencyKey: crypto.randomUUID() });
  assert.equal(data.purchasePayments?.length, 2);
  assert.equal(data.purchasePayments?.reduce((sum, item) => sum + item.amountUsd, 0), 92.4);
  assert.ok(data.transactions.some((entry) => entry.status === "cleared" && entry.category === "Purchase payment"));

  receivePurchaseParcelToLots(data, {
    purchaseOrderId: po.id,
    rows: [{ purchaseOrderItemId: po.items[0].id, receivedQuantity: 5, damagedQuantity: 1, notes: "One hoodie arrived damaged" }],
    idempotencyKey: crypto.randomUUID(),
  });

  assert.equal(data.receivingSessions?.length, 1);
  assert.equal(data.receivingSessions?.[0].status, "issue");
  assert.equal(data.supplierClaims?.[0].type, "damaged");
  assert.equal(data.purchaseBatches?.length, 1);
  assert.equal(data.inventoryLots?.length, 1);
  assert.equal(data.inventoryLots?.[0].quantityReceived, 5);
  assert.ok(data.landedCostComponents?.some((entry) => entry.type === "international_freight"));

  generateReorderRecommendations(data);
  assert.equal(data.reorderRecommendations?.length, 1);
  assert.equal(data.reorderRecommendations?.[0].status, "open");
  const summary = purchasingSummary(data);
  assert.equal(summary.openClaims, 1);
  assert.equal(summary.reorderRecommendations, 1);
  assert.ok(summary.committedSpendUsd > 0);
});
