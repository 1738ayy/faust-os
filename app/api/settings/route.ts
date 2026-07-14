import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/services/settings/repository";
import { settingsInputSchema } from "@/lib/validation/requests";
export async function GET() { return NextResponse.json({ settings: await getSettings() }); }
export async function PUT(request: Request) { try { const body = settingsInputSchema.parse(await request.json()); return NextResponse.json({ settings: await saveSettings(body) }); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Invalid settings." }, { status: 400 }); } }
