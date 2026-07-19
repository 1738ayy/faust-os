import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteCatalogProduct, duplicateCatalogProduct, snapshot } from "@/services/operating-system/repository";

const productActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("duplicate"), variantId: z.string().uuid() }),
  z.object({ action: z.literal("delete"), variantId: z.string().uuid() }),
]);

export async function POST(request: Request) {
  try {
    const body = productActionSchema.parse(await request.json());
    const data = body.action === "duplicate" ? await duplicateCatalogProduct(body.variantId) : await deleteCatalogProduct(body.variantId);
    return NextResponse.json({ ok: true, ...snapshot(data) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Product action failed." }, { status: 400 });
  }
}
