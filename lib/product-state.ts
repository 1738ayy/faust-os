import type { OperatingData, Product, StockBalance, Variant } from "@/domain/business";

const hiddenProductStatuses = new Set<Product["status"]>(["paused", "cancelled"]);

export function isActiveProduct(product: Product | undefined) {
  return Boolean(product && !hiddenProductStatuses.has(product.status));
}

export function isActiveVariant(data: OperatingData, variant: Variant | undefined) {
  if (!variant?.active) return false;
  return isActiveProduct(data.products.find((product) => product.id === variant.productId));
}

export function activeVariants(data: OperatingData) {
  return data.variants.filter((variant) => isActiveVariant(data, variant));
}

export function activeVariantIds(data: OperatingData) {
  return new Set(activeVariants(data).map((variant) => variant.id));
}

export function activeBalances(data: OperatingData): StockBalance[] {
  const ids = activeVariantIds(data);
  return data.balances.filter((balance) => ids.has(balance.variantId));
}

export function findActiveVariant(data: OperatingData, variantId?: string) {
  return activeVariants(data).find((variant) => variant.id === variantId);
}

export function findActiveVariantBySku(data: OperatingData, sku?: string) {
  const normalized = sku?.trim().toLowerCase();
  if (!normalized) return undefined;
  return activeVariants(data).find((variant) => variant.sku.toLowerCase() === normalized);
}

export function activeInventoryValue(data: OperatingData) {
  const variants = activeVariants(data);
  return activeBalances(data).reduce((total, balance) => {
    const variant = variants.find((entry) => entry.id === balance.variantId);
    return total + balance.onHand * (variant?.landedUnitCost ?? 0);
  }, 0);
}
