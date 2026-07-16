import { analyticsActionSchema } from "@/lib/validation/requests";
import { buildAnalyticsModel } from "@/lib/analytics";
import { getOperatingData, mutateAnalytics, snapshot } from "@/services/operating-system/repository";

export async function GET() {
  const data = await getOperatingData();
  return Response.json({ data, analytics: buildAnalyticsModel(data), snapshot: snapshot(data) });
}

export async function POST(request: Request) {
  try {
    const input = analyticsActionSchema.parse(await request.json());
    const result = await mutateAnalytics(input.action, input);
    return Response.json({ ok: true, data: result.data, analytics: buildAnalyticsModel(result.data), snapshot: snapshot(result.data), actionResult: result.actionResult });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Analytics report action failed." }, { status: 400 });
  }
}
