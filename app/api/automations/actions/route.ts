import { automationActionSchema } from "@/lib/validation/requests";
import { getOperatingData, mutateAutomation, snapshot } from "@/services/operating-system/repository";
import type { AutomationMutationInput } from "@/lib/automations";

export async function GET() {
  const data = await getOperatingData();
  return Response.json({ ok: true, data, snapshot: snapshot(data) });
}

export async function POST(request: Request) {
  try {
    const input = automationActionSchema.parse(await request.json());
    const result = await mutateAutomation(input.action, input as AutomationMutationInput);
    return Response.json({ ok: true, data: result.data, actionResult: result.actionResult, snapshot: snapshot(result.data) });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Automation action failed." }, { status: 400 });
  }
}
