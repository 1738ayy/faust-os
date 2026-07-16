import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { analyticsCsv, buildAnalyticsModel, createAnalyticsReport, duplicateAnalyticsReport, ensureAnalyticsCollections, recordAnalyticsReportRun, updateAnalyticsReport } from "../lib/analytics";
import { buildFinanceModel } from "../lib/finance";

const fixture = (): OperatingData => {
  const time = "2026-07-01T12:00:00.000Z";
  const supplierId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const customerId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const orderItemId = crypto.randomUUID();
  const poId = crypto.randomUUID();
  return {
    version: 1, mode: "local", updatedAt: time,
    products: [{ id: productId, title: "Analytics hoodie", category: "Streetwear", tags: ["hoodie"], supplierId, status: "active", createdAt: time, updatedAt: time }],
    variants: [{ id: variantId, productId, sku: "AN-HOOD-L", title: "Analytics Hoodie / L", condition: "New", landedUnitCost: 20, defaultSalePrice: 80, reorderPoint: 2, reorderQuantity: 8, active: true }],
    locations: [{ id: crypto.randomUUID(), label: "A1", warehouse: "Main" }],
    balances: [{ id: crypto.randomUUID(), variantId, onHand: 3, reserved: 1, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 }],
    stockMovements: [],
    suppliers: [{ id: supplierId, name: "1688 Analytics Supplier", sourcePlatform: "1688", leadDays: 9, status: "active" }],
    purchaseOrders: [{ id: poId, supplierId, reference: "PO-AN-1", status: "ordered", orderedAt: "2026-06-20T00:00:00.000Z", expectedAt: "2026-07-10T00:00:00.000Z", totalCost: 160, itemCount: 8, items: [{ id: crypto.randomUUID(), variantId, expectedQuantity: 8, receivedQuantity: 4, unitCost: 20 }] }],
    parcels: [],
    listings: [{ id: crypto.randomUUID(), variantId, marketplace: "Depop", title: "Analytics Hoodie", price: 80, quantity: 1, status: "active", syncState: "manual", createdAt: time }],
    customers: [{ id: customerId, name: "Repeat Buyer", state: "NY", orderCount: 2, lifetimeValue: 200, issueCount: 0 }],
    orders: [{ id: orderId, number: "AN-100", marketplace: "Depop", customerId, status: "delivered", orderedAt: "2026-07-02T10:00:00.000Z", paidAt: "2026-07-02T10:02:00.000Z", shippingCharged: 8, shippingCost: 6, marketplaceFee: 5, paymentFee: 2, taxCollected: 0, shippingAddress: { line1: "1 Main", city: "New York", region: "NY", postalCode: "10001", country: "US" }, statusEvents: [{ id: crypto.randomUUID(), toStatus: "shipped", createdAt: "2026-07-02T16:00:00.000Z" }], items: [{ id: orderItemId, variantId, title: "Analytics Hoodie / L", quantity: 1, unitSellingPrice: 80, discountAllocation: 0, taxAllocation: 0, feeAllocation: 1, unitCost: 20 }] }],
    transactions: [{ id: crypto.randomUUID(), type: "shipping_expense", amount: -6, status: "cleared", occurredAt: "2026-07-02T16:00:00.000Z", orderId, description: "Shipping label", category: "Shipping expense" }],
    tasks: [], notices: [], insights: [], activity: [],
    inventoryLots: [{ id: crypto.randomUUID(), variantId, sku: "AN-HOOD-L", quantityReceived: 5, quantityRemaining: 3, quantityReserved: 0, unitProductCostUsd: 18, unitLandedCostUsd: 20, totalLandedCostUsd: 100, currency: "USD", originalUnitCost: 18, exchangeRate: 1, condition: "available", sourceType: "purchase_batch", receivedAt: "2026-06-22T00:00:00.000Z", createdAt: "2026-06-22T00:00:00.000Z" }],
    purchaseBatches: [], landedCostComponents: [], exchangeRates: [], orderItemCostAllocations: [], journalEntries: [], journalLines: [], outboxEvents: [], durableJobs: [], deadLetters: [], channelSyncStates: [], inventoryRiskLocks: [], physicalSkuMappings: [],
    marketplaceAccounts: [], listingTemplates: [], channelListingDrafts: [{ id: crypto.randomUUID(), listingId: crypto.randomUUID(), variantId, physicalSku: "PHY-AN-HOOD", marketplace: "Depop", title: "Analytics Hoodie", description: "Test", price: 80, category: "Streetwear", attributes: {}, imageUrls: [], quantity: 1, status: "published", publishMode: "adapter", validationErrors: [], syncState: "clean", createdAt: time }], listingSyncJobs: [], listingReviewItems: [],
    supplierContacts: [], supplierCommunications: [],
    supplierScorecards: [{ id: crypto.randomUUID(), supplierId, qualityScore: 90, leadTimeScore: 91, communicationScore: 85, priceScore: 88, defectRate: 0.05, onTimeRate: 0.95, averageLeadDays: 9, totalSpendUsd: 160, claimCount: 1, lastReviewedAt: time, updatedAt: time }],
    purchaseApprovals: [], purchasePayments: [{ id: crypto.randomUUID(), purchaseOrderId: poId, supplierId, type: "deposit", currency: "RMB", amountOriginal: 500, exchangeRate: 0.14, amountUsd: 70, status: "paid", paidAt: time, createdAt: time }],
    freightConsolidations: [{ id: crypto.randomUUID(), supplierId, parcelIds: [], status: "planning", domesticFreightUsd: 8, internationalFreightUsd: 20, dutiesUsd: 4, customsUsd: 2, allocationMethod: "by_value", createdAt: time }],
    receivingSessions: [{ id: crypto.randomUUID(), purchaseOrderId: poId, status: "issue", receivedAt: time, createdAt: time, rows: [{ id: crypto.randomUUID(), purchaseOrderItemId: crypto.randomUUID(), variantId, expectedQuantity: 5, receivedQuantity: 4, damagedQuantity: 1, shortageQuantity: 0, overageQuantity: 0 }] }],
    supplierClaims: [{ id: crypto.randomUUID(), supplierId, purchaseOrderId: poId, type: "damaged", status: "open", quantity: 1, detail: "Damaged", openedAt: time, activity: [] }],
    supplierPriceHistory: [{ id: crypto.randomUUID(), supplierId, variantId, currency: "RMB", unitCostOriginal: 128, exchangeRate: 0.14, unitCostUsd: 17.92, minimumOrderQuantity: 5, capturedAt: time }],
    reorderRecommendations: [{ id: crypto.randomUUID(), variantId, supplierId, recommendedQuantity: 8, reorderPoint: 2, safetyStock: 4, available: 2, incoming: 0, velocity30d: 1, estimatedCostUsd: 160, status: "open", createdAt: time }],
  };
};

test("analytics decision engine derives every metric family from operating source records", () => {
  const data = fixture();
  const analytics = buildAnalyticsModel(data);
  const finance = buildFinanceModel(data);
  assert.equal(analytics.executive.netRevenue, finance.overview.netSales);
  assert.equal(analytics.executive.deployableCash, finance.overview.deployableCash);
  assert.equal(analytics.products[0].sku, "AN-HOOD-L");
  assert.ok(analytics.products[0].profit > 0);
  assert.equal(analytics.channels.find((channel) => channel.marketplace === "Depop")?.revenue, analytics.executive.netRevenue);
  assert.equal(analytics.suppliers[0].supplierScore, 89);
  assert.equal(analytics.purchasing.openPurchaseOrders, 1);
  assert.equal(analytics.inventory.lowStock, 1);
  assert.ok(analytics.fulfillment.sameDayShippingRate > 0);
  assert.equal(analytics.finance.payoutDiscrepancies, 0);
  assert.equal(analytics.customers.customers[0].marketplaceOrigin, "Depop");
  assert.equal(analytics.geography[0].state, "NY");
  assert.ok(analytics.reports.some((report) => report.name === "SKU profitability and lot performance"));
  assert.ok(analytics.products[0].lotProfitability[0].capitalUtilization > 0);
  assert.ok(analytics.inventory.lotAging[0].sourceHref.includes("lot="));
  assert.match(analyticsCsv(analytics), /sku-profitability|AN-HOOD-L|Depop/);
});

test("analytics filters by marketplace and SKU without changing source records", () => {
  const data = fixture();
  const depop = buildAnalyticsModel(data, { marketplace: "Depop", sku: "AN-HOOD-L" });
  const etsy = buildAnalyticsModel(data, { marketplace: "Etsy" });
  assert.equal(depop.executive.orders, 1);
  assert.equal(etsy.executive.orders, 0);
  assert.equal(data.orders.length, 1);
});

test("analytics saved reports persist filters, schedules, duplicates, and run history", () => {
  const data = fixture();
  ensureAnalyticsCollections(data);
  const report = createAnalyticsReport(data, { name: "Supplier vs SKU decision report", sections: ["Supplier Analytics", "Product Analytics"], metrics: ["supplierScore", "capitalUtilization"], filters: { marketplace: "Depop", sku: "AN-HOOD-L" }, scheduleFrequency: "weekly", recipients: ["ops@example.test"], idempotencyKey: crypto.randomUUID() });
  assert.equal(report.schedule?.frequency, "weekly");
  assert.equal(data.analyticsSavedReports?.[0].name, "Supplier vs SKU decision report");
  assert.equal(data.analyticsFilterPresets?.[0].filters.sku, "AN-HOOD-L");
  updateAnalyticsReport(data, { reportId: report.id, filters: { marketplace: "Depop" }, scheduleFrequency: "daily", recipients: ["founder@example.test"] });
  assert.equal(data.analyticsSavedReports?.[0].schedule?.frequency, "daily");
  const copy = duplicateAnalyticsReport(data, report.id);
  assert.equal(copy.name, "Supplier vs SKU decision report copy");
  assert.notEqual(copy.id, report.id);
  assert.deepEqual(copy.filters, report.filters);
  assert.deepEqual(copy.metrics, report.metrics);
  assert.deepEqual(copy.drilldowns, report.drilldowns);
  assert.equal(copy.schedule?.frequency, report.schedule?.frequency);
  assert.deepEqual(copy.schedule?.recipients, report.schedule?.recipients);
  assert.equal(data.analyticsFilterPresets?.[0].name, "Supplier vs SKU decision report copy filters");
  const secondCopy = duplicateAnalyticsReport(data, report.id);
  assert.equal(secondCopy.name, "Supplier vs SKU decision report copy 2");
  const run = recordAnalyticsReportRun(data, report.id, { marketplace: "Depop" }, 12);
  assert.equal(run.status, "completed");
  assert.equal(data.analyticsReportRuns?.[0].exportedRowCount, 12);
  assert.equal(buildAnalyticsModel(data).reportRuns.length, 1);
});
