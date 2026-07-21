import { NextResponse } from "next/server";

import { getLatestImportedProduct } from "@/services/imports/local-product-store";
import { getOperatingData } from "@/services/operating-system/repository";
import { buildImportQueue, getImportQueueProduct } from "@/lib/import-queue";

export async function GET(request: Request) {
  const data = await getOperatingData();
  const id = new URL(request.url).searchParams.get("id");
  const selectedProduct = id ? getImportQueueProduct(data, id) : undefined;
  const activeQueue = buildImportQueue(data).scans;
  const product = selectedProduct || activeQueue[0]?.product || await getLatestImportedProduct();
  if (!product) {
    return NextResponse.json({ success: false, message: "No Superbuy product has been imported yet." }, { status: 404 });
  }
  return NextResponse.json({ success: true, product, queueItemId: id || activeQueue[0]?.id });
}
