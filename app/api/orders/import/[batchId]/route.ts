import { NextResponse } from "next/server";
import { getOrderImportBatchResultRpc } from "@/services/operating-system/supabase-repository";
export async function GET(_: Request, { params }: { params: Promise<{ batchId: string }> }) { try { return NextResponse.json(await getOrderImportBatchResultRpc((await params).batchId)); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Import batch not found." }, { status: 400 }); } }
