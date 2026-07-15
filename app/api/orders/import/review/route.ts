import { NextResponse } from "next/server";
import { orderImportResolutionSchema } from "@/lib/validation/requests";
import { resolveOrderImportReview } from "@/services/operating-system/repository";

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await resolveOrderImportReview(orderImportResolutionSchema.parse(await request.json())) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not update import review." }, { status: 400 });
  }
}
