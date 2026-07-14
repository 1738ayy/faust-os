import type { SuperbuyProduct, SuperbuyVariant } from "@/types/superbuy-product";

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function asImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((image): image is string => typeof image === "string" && /^https?:\/\//.test(image)))];
}

function asVariants(value: unknown): SuperbuyVariant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((variant, index) => {
    if (!variant || typeof variant !== "object") return [];
    const record = variant as Record<string, unknown>;
    const name = asText(record.name);
    if (!name) return [];
    return [{
      id: asText(record.id) ?? `variant-${index}`,
      name,
      options: Array.isArray(record.options) ? record.options.filter((option): option is string => typeof option === "string") : [],
      image: asText(record.image),
      price: asNumber(record.price),
      stock: asNumber(record.stock),
    }];
  });
}

/** Converts untrusted extension data into the one import model used by Faust. */
export function parseSuperbuyProduct(value: unknown): SuperbuyProduct {
  if (!value || typeof value !== "object") throw new Error("Import payload must be an object.");
  const input = value as Record<string, unknown>;
  const title = asText(input.title);
  const superbuyUrl = asText(input.superbuyUrl);

  if (!title) throw new Error("A Superbuy product title is required.");
  if (!superbuyUrl || !/^https:\/\/([\w-]+\.)?superbuy\.com\//.test(superbuyUrl)) {
    throw new Error("A valid Superbuy product URL is required.");
  }

  const min = asNumber((input.priceRange as Record<string, unknown> | undefined)?.min);
  const max = asNumber((input.priceRange as Record<string, unknown> | undefined)?.max);

  return {
    source: "superbuy",
    importedAt: asText(input.importedAt) ?? new Date().toISOString(),
    title,
    superbuyUrl,
    original1688Url: asText(input.original1688Url),
    supplier: asText(input.supplier),
    supplierStoreUrl: asText(input.supplierStoreUrl),
    factoryName: asText(input.factoryName),
    storeName: asText(input.storeName),
    category: asText(input.category),
    subcategory: asText(input.subcategory),
    description: asText(input.description),
    material: asText(input.material),
    dimensions: asText(input.dimensions),
    weight: asText(input.weight),
    shippingWeight: asText(input.shippingWeight),
    packageSize: asText(input.packageSize),
    packageInfo: asText(input.packageInfo),
    stock: asNumber(input.stock),
    minimumOrderQuantity: asNumber(input.minimumOrderQuantity),
    price: asNumber(input.price),
    domesticShipping: asNumber(input.domesticShipping),
    internationalShipping: asNumber(input.internationalShipping),
    priceRange: min !== undefined && max !== undefined ? { min, max } : undefined,
    images: asImages(input.images),
    variants: asVariants(input.variants),
  };
}
