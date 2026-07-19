import { NextResponse } from "next/server";
import { getOperatingData, receiveParcel, resetOperatingData, snapshot, transitionOrder } from "@/services/operating-system/repository";
import { operatingActionSchema } from "@/lib/validation/requests";

export async function GET() { return NextResponse.json(snapshot(await getOperatingData())); }
export async function POST(request: Request) {
  try {
    const body = operatingActionSchema.parse(await request.json());
    if (body.action === "reset") return NextResponse.json(snapshot(await resetOperatingData()));
    if (body.action === "transition-order" && body.id && body.status) return NextResponse.json(snapshot(await transitionOrder(body.id, body.status)));
    if (body.action === "receive-parcel" && body.id) return NextResponse.json(snapshot(await receiveParcel(body.id)));
    return NextResponse.json({ message: "Unsupported operation." }, { status: 400 });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Could not complete operation." }, { status: 400 }); }
}
