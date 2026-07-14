import { NextResponse } from "next/server";
import { suppliersRepository } from "@/services/suppliers/repository";
import type { Supplier } from "@/types/supplier";
export async function GET() { return NextResponse.json({ suppliers: await suppliersRepository.all() }); }
export async function POST(request: Request) { const body = await request.json() as Partial<Supplier>; if (!body.name?.trim()) return NextResponse.json({ message: "Supplier name is required." }, { status: 400 }); const now = new Date().toISOString(); const supplier: Supplier = { id: body.id ?? crypto.randomUUID(), name: body.name.trim(), storeName: body.storeName, storeUrl: body.storeUrl, factoryName: body.factoryName, contacts: body.contacts, notes: body.notes, risk: body.risk ?? "unknown", createdAt: body.createdAt ?? now, updatedAt: now }; return NextResponse.json({ supplier: await suppliersRepository.upsert(supplier) }); }
