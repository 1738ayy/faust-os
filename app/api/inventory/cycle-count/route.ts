import { NextResponse } from "next/server";
import { inventoryCycleCountSchema } from "@/lib/validation/requests";
import { reconcileInventoryCount } from "@/services/operating-system/repository";
export async function POST(request: Request) { try { const input = inventoryCycleCountSchema.parse(await request.json()); return NextResponse.json({ data: await reconcileInventoryCount(input.balanceId, input.countedQuantity, input.idempotencyKey) }); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Cycle count failed." }, { status: 400 }); } }
