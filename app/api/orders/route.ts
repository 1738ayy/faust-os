import { NextResponse } from "next/server";
import { manualOrderSchema } from "@/lib/validation/requests";
import { createOrderTargeted, getOperatingData } from "@/services/operating-system/repository";

export async function GET() { return NextResponse.json({ orders: (await getOperatingData()).orders }); }
export async function POST(request: Request) { try { return NextResponse.json({ data: await createOrderTargeted(manualOrderSchema.parse(await request.json())) }); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Could not create order." }, { status: 400 }); } }
