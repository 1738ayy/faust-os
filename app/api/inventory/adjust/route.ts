import { NextResponse } from "next/server";
import { inventoryAdjustSchema } from "@/lib/validation/requests";
import { adjustInventory } from "@/services/operating-system/repository";
export async function POST(request: Request) { try { const input = inventoryAdjustSchema.parse(await request.json()); return NextResponse.json({ data: await adjustInventory(input.balanceId, input.quantity, [input.reason, input.notes, input.relatedEntityId ? `Related record: ${input.relatedEntityId}` : undefined].filter(Boolean).join(" — "), input.idempotencyKey) }); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Inventory adjustment failed." }, { status: 400 }); } }
