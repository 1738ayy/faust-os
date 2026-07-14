import { NextResponse } from "next/server";
import { orderActionSchema } from "@/lib/validation/requests";
import { attachShippingLabel, cancelOrder, closeOrder, createRefundTargeted, createReturn, markDelivered, markInTransit, markPacked, markReadyToPack, markReadyToShip, partiallyCancelOrder, receiveReturnTargeted, reserveOrderInventory, shipOrder } from "@/services/operating-system/repository";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const input = orderActionSchema.parse(await request.json());
    const data = input.action === "reserve" ? await reserveOrderInventory(id) : input.action === "cancel" ? await cancelOrder(id, input.reason) : input.action === "partial-cancel" ? await partiallyCancelOrder(id, input.lines, input.reason) : input.action === "ready-to-pack" ? await markReadyToPack(id) : input.action === "packed" ? await markPacked(id) : input.action === "attach-label" ? await attachShippingLabel(id, input) : input.action === "ready-to-ship" ? await markReadyToShip(id) : input.action === "ship" ? await shipOrder(id) : input.action === "in-transit" ? await markInTransit(id) : input.action === "delivered" ? await markDelivered(id) : input.action === "close" ? await closeOrder(id) : input.action === "refund" ? await createRefundTargeted(id, input) : input.action === "return" ? await createReturn(id, input) : await receiveReturnTargeted(id, input.returnId, input.dispositions);
    return NextResponse.json({ data });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Order action failed." }, { status: 400 }); }
}
