import type { OperatingData, Product, ProductImageRecord } from "@/domain/business";

const MAX_PRODUCT_IMAGES = 24;

export function normalizeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  if (!url) return undefined;
  if (url.startsWith("blob:") || url.startsWith("chrome-extension:")) return undefined;
  if (/^(https?:\/\/|data:image\/)/i.test(url)) return url;
  return undefined;
}

export function normalizeProductImageUrls(values: unknown[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const value of values) {
    const url = normalizeImageUrl(value);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_PRODUCT_IMAGES) break;
  }
  return urls;
}

export function productImageRecordsFor(productId: string, urls: string[], options: { now: string; id: () => string; existing?: ProductImageRecord[]; sourceType?: ProductImageRecord["sourceType"] }):
  ProductImageRecord[] {
  const byUrl = new Map((options.existing || []).filter((entry) => entry.productId === productId).map((entry) => [entry.url, entry]));
  return normalizeProductImageUrls(urls).map((url, position) => {
    const existing = byUrl.get(url);
    return {
      id: existing?.id || options.id(),
      productId,
      url,
      position,
      isCover: position === 0,
      purpose: position === 0 ? "cover" : existing?.purpose || "source",
      sourceType: existing?.sourceType || options.sourceType || "supplier",
      originalUrl: existing?.originalUrl || url,
      crop: existing?.crop || {},
      altText: existing?.altText,
      createdAt: existing?.createdAt || options.now,
      updatedAt: options.now,
    };
  });
}

export function setProductImages(data: OperatingData, product: Product, urls: unknown[], options: { now: string; id: () => string; sourceType?: ProductImageRecord["sourceType"] }) {
  const normalized = normalizeProductImageUrls(urls);
  product.images = normalized;
  product.image = normalized[0];
  product.updatedAt = options.now;
  data.productImages ||= [];
  data.productImages = [
    ...data.productImages.filter((entry) => entry.productId !== product.id),
    ...productImageRecordsFor(product.id, normalized, { ...options, existing: data.productImages }),
  ].sort((a, b) => a.productId.localeCompare(b.productId) || a.position - b.position);
  return normalized;
}

export function productGallery(data: OperatingData, product: Product): string[] {
  const owned = (data.productImages || [])
    .filter((entry) => entry.productId === product.id)
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.url);
  return normalizeProductImageUrls([...owned, ...(product.images || []), product.image]);
}

export function productCoverImage(data: OperatingData, product: Product): string | undefined {
  return productGallery(data, product)[0];
}

export function ensureProductImageOwnership(data: OperatingData, options: { now: string; id: () => string }) {
  data.productImages ||= [];
  for (const product of data.products) {
    const gallery = productGallery(data, product);
    if (gallery.length) setProductImages(data, product, gallery, { ...options, sourceType: "supplier" });
    else {
      product.images = [];
      product.image = undefined;
    }
  }
  const productIds = new Set(data.products.map((product) => product.id));
  data.productImages = data.productImages.filter((entry) => productIds.has(entry.productId));
  for (const draft of data.channelListingDrafts || []) {
    const variant = data.variants.find((entry) => entry.id === draft.variantId);
    const product = variant ? data.products.find((entry) => entry.id === variant.productId) : undefined;
    const gallery = product ? productGallery(data, product) : [];
    if (gallery.length) draft.imageUrls = gallery;
  }
  return data;
}
