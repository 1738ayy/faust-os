import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteCatalogProduct, duplicateCatalogProduct, getOperatingData, restoreCatalogProduct, saveProductDigitalTwinAsset, snapshot, updateCatalogProduct } from "@/services/operating-system/repository";

const skuSchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/, "SKU can only use letters, numbers, hyphens, and underscores.");

const productActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("duplicate"), variantId: z.string().uuid() }),
  z.object({ action: z.literal("delete"), variantId: z.string().uuid() }),
  z.object({ action: z.literal("restore"), variantId: z.string().uuid() }),
  z.object({ action: z.literal("update"), variantId: z.string().uuid(), title: z.string().trim().min(1).max(300).optional(), sku: skuSchema.optional(), brand: z.string().trim().max(120).optional(), category: z.string().trim().min(1).max(120).optional(), condition: z.string().trim().max(120).optional(), description: z.string().trim().max(2000).optional(), notes: z.string().trim().max(2000).optional(), sourceUrl: z.string().trim().max(1000).optional(), landedUnitCost: z.coerce.number().nonnegative().optional(), defaultSalePrice: z.coerce.number().nonnegative().optional(), images: z.array(z.string().trim().min(1).max(5000)).max(12).optional() }),
  z.object({
    action: z.literal("save-digital-twin"),
    productId: z.string().uuid(),
    sourceImageUrl: z.string().trim().min(1).max(5000),
    transparentImageUrl: z.string().trim().min(1).max(5000).optional(),
    storageKey: z.string().trim().min(1).max(1000).optional(),
    processingStatus: z.enum(["not_started", "queued", "processing", "ready", "failed", "needs_review"]),
    segmentationConfidence: z.coerce.number().min(0).max(1).nullable().optional(),
    bounds: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }).nullable().optional(),
    sourceDimensions: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
    transparentDimensions: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
    processorVersion: z.string().trim().min(1).max(80),
    failureCode: z.string().trim().max(120).nullable().optional(),
  }),
  z.object({ action: z.literal("delete-many"), variantIds: z.array(z.string().uuid()).min(1) }),
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sku = url.searchParams.get("sku") || "";
  const variantId = url.searchParams.get("variantId") || undefined;
  const parsed = skuSchema.safeParse(sku);
  if (!parsed.success) return NextResponse.json({ ok: true, available: false, reason: "invalid" });
  const data = await getOperatingData();
  const match = data.variants.find((entry) => entry.sku.toLowerCase() === parsed.data.toLowerCase() && entry.id !== variantId);
  return NextResponse.json({ ok: true, available: !match, reason: match ? "duplicate" : "available" });
}

export async function POST(request: Request) {
  try {
    const parsed = productActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      const imageIssue = parsed.error.issues.find((issue) => issue.path[0] === "images");
      if (imageIssue) {
        return NextResponse.json({ ok: false, message: "One or more photos still need to upload before saving. Please retry the image upload, then save again." }, { status: 400 });
      }
      return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message || "Product action failed." }, { status: 400 });
    }
    const body = parsed.data;
    const data = body.action === "duplicate"
      ? await duplicateCatalogProduct(body.variantId)
      : body.action === "delete"
        ? await deleteCatalogProduct(body.variantId)
          : body.action === "restore"
            ? await restoreCatalogProduct(body.variantId)
            : body.action === "update"
              ? await updateCatalogProduct(body)
              : body.action === "save-digital-twin"
                ? await saveProductDigitalTwinAsset(body)
                : await body.variantIds.reduce(async (previous, variantId) => {
              await previous;
              return deleteCatalogProduct(variantId);
            }, Promise.resolve(await getOperatingData()));
    return NextResponse.json({ ok: true, ...snapshot(data) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Product action failed." }, { status: 400 });
  }
}
