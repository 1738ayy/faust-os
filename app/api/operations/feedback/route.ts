import { z } from "zod";

import { productionOperationsMetrics } from "@/lib/daily-operations";
import { productionErrorPayload } from "@/lib/production-logging";
import { recordOperationsFeedback, snapshot } from "@/services/operating-system/repository";

const operationsFeedbackSchema = z.object({
  type: z.enum(["bug", "feature_request", "workflow_friction"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  workflow: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  expectedAction: z.string().trim().max(1000).optional(),
  actualAction: z.string().trim().max(1000).optional(),
  timeLostMinutes: z.coerce.number().int().min(0).max(10080).optional(),
  frequency: z.coerce.number().int().min(1).max(1000).optional(),
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  linkedRecordType: z.string().trim().max(80).optional(),
  linkedRecordId: z.string().trim().max(160).optional(),
  workaround: z.string().trim().max(1000).optional(),
  proposedImprovement: z.string().trim().max(1000).optional(),
  source: z.enum(["dogfooding", "internal_ops", "support", "system"]).optional(),
});

export async function POST(request: Request) {
  try {
    const input = operationsFeedbackSchema.parse(await request.json());
    const data = await recordOperationsFeedback(input);
    return Response.json({ ok: true, ...snapshot(data), operations: productionOperationsMetrics(data) });
  } catch (error) {
    return Response.json(productionErrorPayload(error, { route: "/api/operations/feedback" }), { status: 400 });
  }
}
