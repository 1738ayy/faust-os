import assert from "node:assert/strict";
import type { OperatingData } from "../domain/business";
import { activeBalances, activeInventoryValue, activeVariants, isActiveVariant } from "../lib/product-state";

const activeProduct = { id: "product-active", title: "Active hoodie", category: "Streetwear", tags: [], status: "active" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const archivedProduct = { id: "product-archived", title: "Archived tee", category: "Streetwear", tags: [], status: "paused" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const activeVariant = { id: "variant-active", productId: activeProduct.id, sku: "ACTIVE-1", title: "Active / L", condition: "New", landedUnitCost: 10, defaultSalePrice: 40, reorderPoint: 2, reorderQuantity: 6, active: true };
const inactiveVariant = { id: "variant-inactive", productId: archivedProduct.id, sku: "ARCHIVE-1", title: "Archived / L", condition: "New", landedUnitCost: 20, defaultSalePrice: 50, reorderPoint: 3, reorderQuantity: 8, active: false };

const data = {
  version: 1,
  mode: "local",
  products: [activeProduct, archivedProduct],
  variants: [activeVariant, inactiveVariant],
  balances: [
    { id: "balance-active", variantId: activeVariant.id, onHand: 5, reserved: 1, incoming: 2, damaged: 0, returned: 0, lost: 0, quarantined: 0 },
    { id: "balance-archived", variantId: inactiveVariant.id, onHand: 99, reserved: 0, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 },
  ],
  suppliers: [],
  listings: [{ id: "listing-archived", variantId: inactiveVariant.id, marketplace: "Depop", title: "Archived tee", price: 50, quantity: 0, status: "paused", syncState: "manual", createdAt: "2026-01-01T00:00:00.000Z" }],
  orders: [],
  purchaseOrders: [],
  parcels: [],
  locations: [],
  stockMovements: [],
  transactions: [],
  tasks: [],
  notices: [],
  insights: [],
  activity: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as OperatingData;

assert.equal(isActiveVariant(data, activeVariant), true, "active variant with active product is operational");
assert.equal(isActiveVariant(data, inactiveVariant), false, "inactive/archived variant is not operational");
assert.deepEqual(activeVariants(data).map((variant) => variant.sku), ["ACTIVE-1"], "active product lens hides archived variants");
assert.deepEqual(activeBalances(data).map((balance) => balance.id), ["balance-active"], "active balance lens hides archived inventory");
assert.equal(activeInventoryValue(data), 50, "active inventory value excludes archived SKU balances");

console.log("✓ product state synchronization tests passed");
