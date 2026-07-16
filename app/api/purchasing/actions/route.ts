import { NextResponse } from "next/server";
import { purchasingActionSchema } from "@/lib/validation/requests";
import { getOperatingData, getPurchasingSummary, mutatePurchasing, snapshot } from "@/services/operating-system/repository";

export async function GET() {
  return NextResponse.json({ ...snapshot(await getOperatingData()), purchasing: await getPurchasingSummary() });
}

export async function POST(request: Request) {
  try {
    const body = purchasingActionSchema.parse(await request.json());
    const data = await mutatePurchasing(body.action, body);
    return NextResponse.json({ ...snapshot(data), purchasing: await getPurchasingSummary() });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Purchasing operation failed." }, { status: 400 });
  }
}
