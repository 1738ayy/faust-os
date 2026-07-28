import type { MarketplaceImageOrder, OperatingData, ProductImageRecord } from "../../domain/business";
import type { ManagedMarketplace } from "../marketplace-intelligence";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

export function saveMarketplaceImageOrder(data: OperatingData, input: { productId: string; marketplace: ManagedMarketplace; imageIds: string[]; excludedImageIds?: string[]; coverImageId?: string; variantId?: string }) {
  data.marketplaceImageOrders ||= [];
  const product = data.products.find((entry) => entry.id === input.productId);
  if (!product) throw new Error("Product not found for marketplace image order.");
  const imageSet = new Set((data.productImages || []).filter((image) => image.productId === input.productId).map((image) => image.id));
  const unknown = input.imageIds.filter((imageId) => !imageSet.has(imageId));
  if (unknown.length) throw new Error("Marketplace image order references images that do not belong to this product.");
  const existing = data.marketplaceImageOrders.find((entry) => entry.productId === input.productId && entry.variantId === input.variantId && entry.marketplace === input.marketplace);
  if (existing) {
    existing.imageIds = input.imageIds;
    existing.excludedImageIds = input.excludedImageIds || [];
    existing.coverImageId = input.coverImageId || input.imageIds[0];
    existing.updatedAt = now();
    return existing;
  }
  const order: MarketplaceImageOrder = {
    id: id(),
    productId: input.productId,
    variantId: input.variantId,
    marketplace: input.marketplace,
    imageIds: input.imageIds,
    excludedImageIds: input.excludedImageIds || [],
    coverImageId: input.coverImageId || input.imageIds[0],
    createdAt: now(),
    updatedAt: now(),
  };
  data.marketplaceImageOrders.unshift(order);
  return order;
}

export function imageUrlsForMarketplace(data: OperatingData, productId: string, marketplace: ManagedMarketplace) {
  const images = (data.productImages || []).filter((image) => image.productId === productId);
  const order = data.marketplaceImageOrders?.find((entry) => entry.productId === productId && entry.marketplace === marketplace);
  if (!order) return images.sort((a, b) => a.position - b.position).map((image) => image.url);
  const byId = new Map(images.map((image) => [image.id, image]));
  const ordered = order.imageIds.map((imageId) => byId.get(imageId)).filter((image): image is ProductImageRecord => Boolean(image));
  const excluded = new Set(order.excludedImageIds);
  return ordered.filter((image) => !excluded.has(image.id)).map((image) => image.url);
}
