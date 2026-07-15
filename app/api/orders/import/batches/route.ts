import { NextResponse } from "next/server";
import { orderImportBatchActionSchema } from "@/lib/validation/requests";
import { getOperatingData, updateOrderImportBatch } from "@/services/operating-system/repository";

export async function GET() {
  const data = await getOperatingData();
  return NextResponse.json({ batches: data.orderImportBatches || [], reviews: data.orderImportReviews || [] });
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ data: await updateOrderImportBatch(orderImportBatchActionSchema.parse(await request.json())) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not update import batch." }, { status: 400 });
  }
}
