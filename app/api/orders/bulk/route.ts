import { NextResponse } from "next/server";
import { bulkOrderActionSchema } from "@/lib/validation/requests";
import { bulkUpdateOrders } from "@/services/operating-system/repository";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await bulkUpdateOrders(bulkOrderActionSchema.parse(await request.json())));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Bulk order action failed." }, { status: 400 });
  }
}
