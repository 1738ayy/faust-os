import { NextResponse } from "next/server";

import { getOperatingData } from "@/services/operating-system/repository";
import { activeVariants } from "@/lib/product-state";
import { parseSuperbuyProduct } from "@/lib/validation/superbuy-product";

export async function GET() {
  const data = await getOperatingData();
  const scans = (data.extensionArtifacts || [])
    .filter((artifact) => artifact.metadata?.kind === "latest_source_scan" && artifact.metadata.product)
    .map((artifact) => {
      const product = parseSuperbuyProduct(artifact.metadata.product);
      const existingProduct = data.products.find((entry) => entry.sourceUrl === product.superbuyUrl);
      const convertedVariants = existingProduct ? activeVariants(data).filter((variant) => variant.productId === existingProduct.id).length : 0;
      return {
        id: artifact.id,
        title: product.title,
        supplier: product.storeName || product.supplier || "Supplier needs review",
        source: product.source,
        sourceUrl: product.original1688Url || product.superbuyUrl,
        image: product.images[0],
        imageCount: product.images.length,
        variantCount: product.variants.length,
        price: product.price,
        importedAt: product.importedAt || artifact.createdAt,
        status: existingProduct ? "product_created" : "ready_for_review",
        productId: existingProduct?.id,
        convertedVariants,
      };
    });

  return NextResponse.json({ success: true, queue: scans });
}
