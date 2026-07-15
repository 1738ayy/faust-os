import { NextResponse } from "next/server";
import { importBatchConfirmSchema } from "@/lib/validation/requests";
import { confirmOrderImportBatchRpc, getOrderImportBatchResultRpc } from "@/services/operating-system/supabase-repository";
import { confirmOrderImportBatchLocal } from "@/services/operating-system/repository";
import { isProductionAuthEnabled } from "@/lib/env";
export async function POST(request: Request) { try { const input = importBatchConfirmSchema.parse(await request.json()); if (!isProductionAuthEnabled()) return NextResponse.json({ data: await confirmOrderImportBatchLocal(input.batchId) }); const summary = await confirmOrderImportBatchRpc(input.batchId,input.idempotencyKey); return NextResponse.json({ summary, result: await getOrderImportBatchResultRpc(input.batchId) }); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Import confirmation failed." }, { status: 400 }); } }
