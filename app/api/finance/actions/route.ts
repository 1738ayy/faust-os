import { NextResponse } from "next/server";
import { financeActionSchema } from "@/lib/validation/requests";
import { getOperatingData, mutateFinance, snapshot } from "@/services/operating-system/repository";

export async function GET() {
  return NextResponse.json(snapshot(await getOperatingData()));
}

export async function POST(request: Request) {
  try {
    const body = financeActionSchema.parse(await request.json());
    const data = await mutateFinance(body.action, body);
    return NextResponse.json(snapshot(data));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Finance operation failed." }, { status: 400 });
  }
}
