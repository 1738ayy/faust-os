import type { OperatingData, Product, ProductDigitalTwinAsset, ProductImageRecord } from "@/domain/business";

const MAX_PRODUCT_IMAGES = 24;

export function normalizeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  if (!url) return undefined;
  if (/^(blob:|data:image\/|chrome-extension:)/i.test(url)) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/api/import-image?key=") || url.startsWith("/api/import-image?storageKey=")) return url;
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

export function productCoverRecord(data: OperatingData, product: Product): ProductImageRecord | undefined {
  const records = (data.productImages || [])
    .filter((entry) => entry.productId === product.id)
    .sort((a, b) => a.position - b.position);
  if (!records.length) return undefined;
  const canonical = product.coverImageId ? records.find((entry) => entry.id === product.coverImageId) : undefined;
  return canonical || records.find((entry) => entry.isCover) || records[0];
}

function syncCanonicalCover(data: OperatingData, product: Product) {
  const records = (data.productImages || [])
    .filter((entry) => entry.productId === product.id)
    .sort((a, b) => a.position - b.position);
  if (!records.length) {
    product.coverImageId = null;
    product.image = undefined;
    product.images = [];
    return undefined;
  }
  const cover = product.coverImageId ? records.find((entry) => entry.id === product.coverImageId) || records[0] : records.find((entry) => entry.isCover) || records[0];
  product.coverImageId = cover.id;
  product.image = cover.url;
  product.images = records.map((entry) => entry.url);
  for (const entry of records) {
    entry.isCover = entry.id === cover.id;
    entry.purpose = entry.isCover ? "cover" : entry.purpose === "cover" ? "source" : entry.purpose;
  }
  return cover;
}

export function setProductImages(data: OperatingData, product: Product, urls: unknown[], options: { now: string; id: () => string; sourceType?: ProductImageRecord["sourceType"] }) {
  const normalized = normalizeProductImageUrls(urls);
  product.updatedAt = options.now;
  data.productImages ||= [];
  const nextCoverUrl = normalized[0];
  data.productImages = [
    ...data.productImages.filter((entry) => entry.productId !== product.id),
    ...productImageRecordsFor(product.id, normalized, { ...options, existing: data.productImages }),
  ].sort((a, b) => a.productId.localeCompare(b.productId) || a.position - b.position);
  const nextCover = data.productImages.find((entry) => entry.productId === product.id && entry.url === nextCoverUrl);
  product.coverImageId = nextCover?.id || null;
  syncCanonicalCover(data, product);
  return normalized;
}

export function setProductCoverImage(data: OperatingData, product: Product, imageIdOrUrl: string, options: { now: string }) {
  data.productImages ||= [];
  const records = data.productImages.filter((entry) => entry.productId === product.id);
  const cover = records.find((entry) => entry.id === imageIdOrUrl) || records.find((entry) => entry.url === imageIdOrUrl);
  if (!cover) throw new Error("Cover image was not found for this product.");
  product.coverImageId = cover.id;
  product.updatedAt = options.now;
  syncCanonicalCover(data, product);
  return cover;
}

export function productGallery(data: OperatingData, product: Product): string[] {
  const ownedRecords = (data.productImages || [])
    .filter((entry) => entry.productId === product.id)
    .sort((a, b) => a.position - b.position);
  const cover = productCoverRecord(data, product);
  const owned = cover ? [cover.url, ...ownedRecords.filter((entry) => entry.id !== cover.id).map((entry) => entry.url)] : ownedRecords.map((entry) => entry.url);
  return normalizeProductImageUrls([...owned, ...(product.images || []), product.image]);
}

export function productCoverImage(data: OperatingData, product: Product): string | undefined {
  return productCoverRecord(data, product)?.url || productGallery(data, product)[0];
}

export function currentProductDigitalTwin(data: OperatingData, product: Product, processorVersion: string): ProductDigitalTwinAsset | undefined {
  const coverRecord = productCoverRecord(data, product);
  const coverImage = coverRecord?.url || productCoverImage(data, product);
  return (data.productDigitalTwins || [])
    .filter((entry) => entry.productId === product.id && entry.processorVersion === processorVersion)
    .sort((a, b) => {
      const aCurrent = coverRecord ? a.sourceImageId === coverRecord.id : a.sourceImageUrl === coverImage;
      const bCurrent = coverRecord ? b.sourceImageId === coverRecord.id : b.sourceImageUrl === coverImage;
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })[0];
}

export function ensureProductImageOwnership(data: OperatingData, options: { now: string; id: () => string }) {
  data.productImages ||= [];
  for (const product of data.products) {
    const gallery = productGallery(data, product);
    if (gallery.length) setProductImages(data, product, gallery, { ...options, sourceType: "supplier" });
    else {
      product.images = [];
      product.image = undefined;
      product.coverImageId = null;
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
