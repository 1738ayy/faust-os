import { NextResponse } from "next/server";
import { savedOrderViewActionSchema } from "@/lib/validation/requests";
import { updateSavedOrderView } from "@/services/operating-system/repository";

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await updateSavedOrderView(savedOrderViewActionSchema.parse(await request.json())) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not update saved view." }, { status: 400 });
  }
}
