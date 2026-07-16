import assert from "node:assert/strict";
import type { OperatingData, Order, Variant } from "../domain/business";
import { buildFinanceLedger, buildFinanceModel, defaultFinanceCategories, defaultFinancialAccounts, deterministicUuid, reconcileOrder } from "../lib/finance";
import { financeActionSchema } from "../lib/validation/requests";

const time = "2026-01-01T00:00:00.000Z";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const variant: Variant = { id: "variant-1", productId: "product-1", sku: "SKU-1", title: "Charcoal hoodie / L", condition: "new", landedUnitCost: 30, defaultSalePrice: 100, reorderPoint: 2, reorderQuantity: 5, active: true };
const order: Order = { id: "order-1", number: "FO-9001", marketplace: "Depop", customerId: "customer-1", items: [{ id: "line-1", variantId: variant.id, title: variant.title, quantity: 2, unitSellingPrice: 100, discountAllocation: 10, taxAllocation: 0, marketplaceFeeAllocation: 2, paymentFeeAllocation: 1, feeAllocation: 2, unitCost: 30 }], shippingCharged: 12, shippingCost: 8, packagingCost: 2, advertisingCost: 5, marketplaceFee: 18, paymentFee: 6, taxCollected: 0, status: "delivered", orderedAt: time, refunds: [{ id: "refund-1", amount: 20, reason: "Partial goodwill refund", refundedAt: "2026-01-02T00:00:00.000Z", itemId: "line-1" }] };
const data: OperatingData = { version: 1, mode: "local", products: [], variants: [variant], locations: [], balances: [{ id: "balance-1", variantId: variant.id, onHand: 4, reserved: 0, incoming: 3, damaged: 0, returned: 0, lost: 0, quarantined: 0 }], stockMovements: [], suppliers: [], purchaseOrders: [{ id: "po-1", supplierId: "supplier-1", reference: "PO-1", status: "ordered", orderedAt: time, totalCost: 150, itemCount: 5, items: [{ id: "po-line-1", variantId: variant.id, expectedQuantity: 5, receivedQuantity: 0, unitCost: 30 }] }], parcels: [], listings: [], customers: [{ id: "customer-1", name: "Jordan", orderCount: 1, lifetimeValue: 212, issueCount: 0 }], orders: [order], transactions: [{ id: "cash-opening", type: "owner_contribution", amount: 500, status: "cleared", occurredAt: time, description: "Owner seed cash", category: "Owner equity" }, { id: "ship-expense", type: "shipping_expense", amount: -8, status: "cleared", occurredAt: time, orderId: order.id, sourceType: "shipment", sourceId: "shipment-1", description: "USPS postage", category: "Shipping expense" }, { id: "software", type: "software", amount: -29, status: "pending", occurredAt: time, description: "Listing tool", category: "Software" }], tasks: [], notices: [], insights: [], activity: [], updatedAt: time };

const reconciliation = reconcileOrder(order, data);
assert.equal(reconciliation.grossSale, 212, "gross sale includes item sales and buyer-paid shipping");
assert.equal(reconciliation.netSale, 182, "net sale subtracts discounts and refunds");
assert.equal(reconciliation.cogs, 60, "COGS uses line unit cost and quantity");
assert.equal(reconciliation.contributionProfit, 80, "contribution profit subtracts COGS, fees, shipping, packaging, and advertising");
assert.equal(reconciliation.lineLevel[0].contributionProfit, 127, "line-level contribution is independently visible");

const ledger = buildFinanceLedger(data);
assert.ok(ledger.some((entry) => entry.type === "sale" && entry.orderId === order.id), "sale to ledger is generated from order");
assert.ok(ledger.some((entry) => entry.type === "refund" && entry.sourceId === "refund-1"), "refund to ledger is generated from refund record");
assert.ok(ledger.some((entry) => entry.type === "shipping_expense" && entry.sourceId === "shipment-1"), "shipping cost event remains linked to shipment source");

const finance = buildFinanceModel(data);
assert.equal(finance.overview.grossSales, 212, "overview uses reconciled gross sales");
assert.equal(finance.overview.taxReserve, 14.4, "tax reserve uses transparent contribution-profit rate");
assert.equal(finance.overview.deployableCash, finance.overview.deployableComponents.reduce((total, component) => Math.round((total + component.amount) * 100) / 100, 0), "deployable cash equals the transparent component formula");
assert.equal(finance.payoutReconciliations[0].status, "open", "expected payout reconciliation is available before bank credentials");
assert.ok(finance.budgets.some((budget) => budget.category === "Software" && budget.status === "on_track"), "budget variance is calculated by category");
assert.ok(finance.forecasts[0].assumptions.length >= 3, "forecast exposes assumptions");
assert.ok(finance.forecasts[0].confidence > 0 && finance.forecasts[0].confidence < 1, "forecast exposes confidence");
for (const entity of [...defaultFinancialAccounts(time), ...defaultFinanceCategories(time), ...finance.expenses, ...finance.payouts, ...finance.payoutReconciliations, ...finance.budgets, ...finance.taxReserve, ...finance.allocations, ...finance.forecasts]) {
  assert.match(entity.id, uuidPattern, `finance entity ${entity.id} uses a UUID-compatible persisted ID`);
}
assert.match(deterministicUuid("same-finance-key"), uuidPattern, "deterministic finance IDs are valid UUIDs");
assert.deepEqual(deterministicUuid("same-finance-key"), deterministicUuid("same-finance-key"), "deterministic finance IDs are stable");
assert.equal(financeActionSchema.parse({ action: "create-expense", vendor: "Vendor", category: "Software", amount: 10 }).action, "create-expense", "create finance actions do not require existing record IDs");
assert.throws(() => financeActionSchema.parse({ action: "edit-expense", id: "expense-1", vendor: "Vendor" }), /uuid/i, "update finance actions reject malformed IDs");
const parsedExpenseUpdate = financeActionSchema.parse({ action: "edit-expense", id: finance.expenses[0].id, vendor: "Vendor" });
assert.equal(parsedExpenseUpdate.action, "edit-expense", "update finance actions retain their discriminant");
if (parsedExpenseUpdate.action === "edit-expense") assert.equal(parsedExpenseUpdate.id, finance.expenses[0].id, "update finance actions accept persisted UUIDs");
console.log("✓ finance ledger, reconciliation, cash, budget, tax, and forecast tests passed");
