import { aiCenterActionSchema } from "@/lib/validation/requests";
import { mutateAiCenter, getOperatingData, snapshot } from "@/services/operating-system/repository";
import { buildAiOperatingContext, ensureAiCollections } from "@/lib/ai-center";
import type { AiCenterActionInput } from "@/lib/ai-center";

export async function GET() {
  const data = await getOperatingData();
  ensureAiCollections(data);
  return Response.json({ ok: true, data, context: buildAiOperatingContext(data), snapshot: snapshot(data) });
}

export async function POST(request: Request) {
  try {
    const input = aiCenterActionSchema.parse(await request.json()) as AiCenterActionInput;
    const result = await mutateAiCenter(input);
    return Response.json({ ok: true, data: result.data, actionResult: result.actionResult, context: buildAiOperatingContext(result.data), snapshot: snapshot(result.data) });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "AI Center action failed." }, { status: 400 });
  }
}
