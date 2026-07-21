import { NextResponse } from "next/server";
import { z } from "zod";

import { buildImportQueue } from "@/lib/import-queue";
import { getOperatingData, removeImportQueueItems } from "@/services/operating-system/repository";

const queueActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), ids: z.array(z.string().uuid()).min(1) }),
]);

export async function GET() {
  const data = await getOperatingData();
  const { scans, counts } = buildImportQueue(data);

  return NextResponse.json({ success: true, queue: scans, counts });
}

export async function POST(request: Request) {
  try {
    const input = queueActionSchema.parse(await request.json());
    const data = await removeImportQueueItems(input.ids);
    const { scans, counts } = buildImportQueue(data);
    return NextResponse.json({ success: true, queue: scans, counts, removed: input.ids.length });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Import queue action failed." }, { status: 400 });
  }
}
