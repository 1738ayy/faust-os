import { NextResponse } from "next/server";
import { inventoryTransferSchema } from "@/lib/validation/requests";
import { transferInventory } from "@/services/operating-system/repository";
export async function POST(request: Request) { try { const input = inventoryTransferSchema.parse(await request.json()); return NextResponse.json({ data: await transferInventory(input.sourceBalanceId, input.destinationBalanceId, input.quantity, input.notes, input.idempotencyKey) }); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Inventory transfer failed." }, { status: 400 }); } }
