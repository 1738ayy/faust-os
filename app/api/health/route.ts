import { NextResponse } from "next/server";
import { productionHealth } from "@/lib/production-health";
import { assertNoServerSecretsInPublicEnv } from "@/lib/production-config";
import { getOperatingData } from "@/services/operating-system/repository";

export async function GET() {
  try {
    assertNoServerSecretsInPublicEnv();
    const data = await getOperatingData().catch(() => undefined);
    const health = productionHealth(data);
    return NextResponse.json(health, { status: health.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({ ok: false, status: "blocked", message: error instanceof Error ? error.message : "Health check failed." }, { status: 503 });
  }
}
