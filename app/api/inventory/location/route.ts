import { NextResponse } from "next/server";
import { inventoryLocationSchema } from "@/lib/validation/requests";
import { assignInventoryLocation } from "@/services/operating-system/repository";

export async function POST(request: Request) {
  try {
    const input = inventoryLocationSchema.parse(await request.json());
    return NextResponse.json({ data: await assignInventoryLocation(input.balanceId, input.locationId, [input.reason, input.notes].filter(Boolean).join(" — "), input.idempotencyKey) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Location assignment failed." }, { status: 400 });
  }
}
