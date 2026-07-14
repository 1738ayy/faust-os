import { NextResponse } from "next/server";

import { saveLatestImportedProduct } from "@/services/imports/local-product-store";
import { parseSuperbuyProduct } from "@/lib/validation/superbuy-product";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const product = parseSuperbuyProduct(await request.json());
    await saveLatestImportedProduct(product);
    return NextResponse.json({ success: true, product }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to import product." },
      { status: 400, headers: corsHeaders }
    );
  }
}
