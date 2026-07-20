import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteCatalogProduct, duplicateCatalogProduct, getOperatingData, restoreCatalogProduct, snapshot } from "@/services/operating-system/repository";

const productActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("duplicate"), variantId: z.string().uuid() }),
  z.object({ action: z.literal("delete"), variantId: z.string().uuid() }),
  z.object({ action: z.literal("restore"), variantId: z.string().uuid() }),
  z.object({ action: z.literal("delete-many"), variantIds: z.array(z.string().uuid()).min(1) }),
]);

export async function POST(request: Request) {
  try {
    const body = productActionSchema.parse(await request.json());
    const data = body.action === "duplicate"
      ? await duplicateCatalogProduct(body.variantId)
      : body.action === "delete"
        ? await deleteCatalogProduct(body.variantId)
        : body.action === "restore"
          ? await restoreCatalogProduct(body.variantId)
          : await body.variantIds.reduce(async (previous, variantId) => {
              await previous;
              return deleteCatalogProduct(variantId);
            }, Promise.resolve(await getOperatingData()));
    return NextResponse.json({ ok: true, ...snapshot(data) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Product action failed." }, { status: 400 });
  }
}
