import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessRepository } from "@/services/business/repository";
import { businessInputSchema } from "@/lib/validation/requests";

export async function GET() { const user = await getCurrentUser(); const businesses = await getBusinessRepository().listForUser(user.id); return NextResponse.json({ businesses, mode: user.mode }); }
export async function POST(request: Request) { try { const user = await getCurrentUser(); const input = businessInputSchema.parse(await request.json()); const business = await getBusinessRepository().create(user.id, { name: input.name, currency: input.currency.toUpperCase(), timezone: input.timezone }); const response = NextResponse.json({ business }); response.cookies.set("faust-active-business", business.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" }); return response; } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Could not create business." }, { status: 400 }); } }
