import assert from "node:assert/strict";
import { availableCash, availableUnits, landedCost, marketplaceFee, orderProfit, reorderSuggestion } from "../lib/business-calculations";
import type { Order, StockBalance, Variant } from "../domain/business";

const variant: Variant = { id: "variant", productId: "product", sku: "SKU", title: "Variant", condition: "new", landedUnitCost: 30, defaultSalePrice: 100, reorderPoint: 2, reorderQuantity: 6, active: true };
const balance: StockBalance = { id: "balance", variantId: variant.id, onHand: 5, reserved: 1, incoming: 0, damaged: 1, returned: 0, lost: 0, quarantined: 0 };
const order: Order = { id: "order", number: "FO-1", marketplace: "Depop", customerId: "customer", items: [{ id: "line", variantId: variant.id, title: "Variant", quantity: 1, unitSellingPrice: 100, discountAllocation: 0, taxAllocation: 0, feeAllocation: 0, unitCost: 30 }], shippingCharged: 10, shippingCost: 8, marketplaceFee: 10, paymentFee: 3, taxCollected: 0, status: "paid", orderedAt: "2026-01-01T00:00:00.000Z" };
assert.equal(landedCost(20, 2, 3, 4, 1), 30, "landed cost includes all landed inputs");
assert.equal(marketplaceFee(100, 0.1), 10, "marketplace fee uses rate");
assert.equal(availableUnits(balance), 3, "available inventory excludes reservations and unusable stock");
assert.equal(orderProfit(order, variant).netProfit, 59, "order profit reconciles revenue, COGS and fees");
assert.equal(reorderSuggestion(balance, variant), 0, "healthy stock does not create reorder");
assert.equal(availableCash([{ id: "a", type: "sale", amount: 50, status: "cleared", occurredAt: "", description: "", category: "" }, { id: "b", type: "expense", amount: -10, status: "pending", occurredAt: "", description: "", category: "" }]), 50, "cash uses cleared ledger entries only");
console.log("✓ business calculation tests passed");
