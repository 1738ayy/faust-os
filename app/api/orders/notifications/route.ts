import { NextResponse } from "next/server";
import { orderNoticeActionSchema } from "@/lib/validation/requests";
import { updateOrderNotice } from "@/services/operating-system/repository";

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await updateOrderNotice(orderNoticeActionSchema.parse(await request.json())) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not update notification." }, { status: 400 });
  }
}
