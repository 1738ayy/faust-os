import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/sign-in", "/sign-up", "/forgot-password", "/update-password", "/auth/callback", "/api/auth", "/api/health"];
export async function proxy(request: NextRequest) {
  const enabled = process.env.NEXT_PUBLIC_FAUST_AUTH_ENABLED === "true" && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!enabled || publicPaths.some((path) => request.nextUrl.pathname.startsWith(path))) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll() { return request.cookies.getAll(); }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { const login = new URL("/sign-in", request.url); login.searchParams.set("next", request.nextUrl.pathname); return NextResponse.redirect(login); }
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
