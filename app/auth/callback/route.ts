import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isProductionAuthEnabled } from "@/lib/env";
export async function GET(request: Request) { const url = new URL(request.url); const code = url.searchParams.get("code"); const next = url.searchParams.get("next") || "/"; if (!isProductionAuthEnabled() || !code) return NextResponse.redirect(new URL("/sign-in", url.origin)); const supabase = await getSupabaseServerClient(); const { error } = await supabase.auth.exchangeCodeForSession(code); return NextResponse.redirect(new URL(error ? "/sign-in?error=callback" : next, url.origin)); }
