import { NextResponse } from "next/server";

import { getLatestImportedProduct } from "@/services/imports/local-product-store";

export async function GET() {
  const product = await getLatestImportedProduct();
  if (!product) {
    return NextResponse.json({ success: false, message: "No Superbuy product has been imported yet." }, { status: 404 });
  }
  return NextResponse.json({ success: true, product });
}
