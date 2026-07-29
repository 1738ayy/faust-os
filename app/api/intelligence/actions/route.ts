import { intelligenceActionSchema } from "@/lib/validation/requests";
import { intelligenceStudioSummary } from "@/lib/intelligence-observability";
import { getOperatingData, mutateIntelligence, snapshot } from "@/services/operating-system/repository";
import type { IntelligenceActionInput } from "@/lib/intelligence-observability";

export async function GET() {
  const data = await getOperatingData();
  return Response.json({ ok: true, data, summary: intelligenceStudioSummary(data), snapshot: snapshot(data) });
}

export async function POST(request: Request) {
  try {
    const input = intelligenceActionSchema.parse(await request.json());
    const result = await mutateIntelligence(input.action, input as IntelligenceActionInput);
    return Response.json({ ok: true, data: result.data, actionResult: result.actionResult, summary: intelligenceStudioSummary(result.data), snapshot: snapshot(result.data) });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Intelligence action failed." }, { status: 400 });
  }
}
