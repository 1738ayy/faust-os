import { NextResponse } from "next/server";
import { parseOrderCsv, reviewImportedLine } from "@/lib/order-import";
import { createOrderImportBatch, getOperatingData } from "@/services/operating-system/repository";
import type { Marketplace, OrderImportReview } from "@/domain/business";

export async function POST(request: Request) {
  try {
    const form = await request.formData(); const file = form.get("file"); const marketplace = String(form.get("marketplace") || "Manual") as Marketplace;
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ message: "Upload a CSV file." }, { status: 400 });
    const parsed = parseOrderCsv(await file.text(), marketplace); const data = await getOperatingData(); const duplicates = parsed.lines.filter((line) => data.orders.some((order) => order.marketplace === line.marketplace && order.number === line.externalOrderId)).map((line) => line.externalOrderId); const reviews = parsed.lines.map((line) => reviewImportedLine(line, data.variants)).filter((review): review is OrderImportReview => Boolean(review));
    const mapping = ["external order id", "customer", "email", "sku", "listing id", "title", "quantity", "unit price", "tax", "shipping", "marketplace fee", "payment fee", "order date", "status"];
    const stored = await createOrderImportBatch({ filename: file.name, marketplace, lines: parsed.lines, errors: parsed.errors, duplicates, reviews, mapping });
    const batch = stored.orderImportBatches?.[0];
    return NextResponse.json({ batchId: batch?.id, mapping, accepted: batch?.acceptedRows ?? 0, rejected: batch?.rejectedRows ?? parsed.errors.length, errors: parsed.errors, duplicates, reviews, lines: parsed.lines, batch });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Could not preview import." }, { status: 400 }); }
}
