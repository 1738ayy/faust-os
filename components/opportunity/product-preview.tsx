"use client";

import { ProductImageManager } from "@/components/products/product-image-manager";
import { useOpportunity } from "./opportunity-provider";

export function ProductPreview() {
  const { opportunity, updateImages } = useOpportunity();
  if (!opportunity) return null;

  const product = opportunity.product;
  const facts: [string, string | number | undefined][] = [
    ["Supplier", product.supplier.name || product.supplier.storeName],
    ["Factory", product.supplier.factoryName],
    ["Weight", product.weight],
    ["Package", product.packageInfo || product.packageSize],
    ["Variants", product.variants.length ? String(product.variants.length) : undefined],
  ];

  return (
    <ProductImageManager
      title="Photos and source preview"
      description="First slot is the Cover. Drag photos to reorder, use × to remove, or crop from the tile."
      productName={product.name}
      images={product.media.images}
      onChange={updateImages}
      maxPhotos={8}
      storageKey={opportunity.importQueueItemId || opportunity.id}
      facts={facts}
      links={[
        { label: "Superbuy", href: product.sourcing.superbuyUrl },
        { label: "Original listing", href: product.sourcing.original1688Url },
      ]}
    />
  );
}
