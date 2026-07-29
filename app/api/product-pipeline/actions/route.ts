import { NextResponse } from "next/server";
import { z } from "zod";
import { buildProductExperiences } from "@/lib/product-experience";
import { buildProductPipeline } from "@/lib/product-pipeline";
import { getOperatingData, mutateProductPipeline, snapshot } from "@/services/operating-system/repository";

const pipelineActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start-review-session") }),
  z.object({
    action: z.literal("record-bulk-operation"),
    operationType: z.enum(["approve_supplier_facts", "approve_materials", "approve_cover_images", "approve_categories", "generate_descriptions", "generate_drafts", "apply_marketplace_defaults", "generate_keywords", "publish_ready_products"]),
    queueItemIds: z.array(z.string().min(1)).default([]),
    productIds: z.array(z.string().uuid()).default([]),
    skippedQueueItemIds: z.array(z.string().min(1)).optional(),
    resultSummary: z.string().max(500).optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    const parsed = pipelineActionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message || "Pipeline action failed." }, { status: 400 });
    const data = await getOperatingData();
    const pipeline = buildProductPipeline(data, buildProductExperiences(data));
    const result = await mutateProductPipeline(pipeline, parsed.data);
    return NextResponse.json({ ok: true, ...snapshot(result.data), actionResult: result.actionResult });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Pipeline action failed." }, { status: 400 });
  }
}
