import { NextResponse } from "next/server";

import { getLatestImportedProduct } from "@/services/imports/local-product-store";
import { getOperatingData } from "@/services/operating-system/repository";
import { parseSuperbuyProduct } from "@/lib/validation/superbuy-product";

export async function GET() {
  const data = await getOperatingData();
  const latestScan = data.extensionArtifacts
    ?.find((artifact) => artifact.metadata?.kind === "latest_source_scan" && artifact.metadata.product)
    ?.metadata?.product;
  const product = latestScan ? parseSuperbuyProduct(latestScan) : await getLatestImportedProduct();
  if (!product) {
    return NextResponse.json({ success: false, message: "No Superbuy product has been imported yet." }, { status: 404 });
  }
  return NextResponse.json({ success: true, product });
}
