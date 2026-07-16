import { NextResponse } from "next/server";
import { wholesaleCoreActionSchema } from "@/lib/validation/requests";
import { getOperatingData, getWholesaleCoreSummary, mutateWholesaleCore, snapshot } from "@/services/operating-system/repository";

export async function GET() {
  return NextResponse.json({ ...snapshot(await getOperatingData()), wholesaleCore: await getWholesaleCoreSummary() });
}

export async function POST(request: Request) {
  try {
    const body = wholesaleCoreActionSchema.parse(await request.json());
    const data = await mutateWholesaleCore(body.action, body);
    return NextResponse.json({ ...snapshot(data), wholesaleCore: await getWholesaleCoreSummary() });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Wholesale core operation failed." }, { status: 400 });
  }
}
