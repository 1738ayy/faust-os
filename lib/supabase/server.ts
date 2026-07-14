import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "@/lib/env";

export async function getSupabaseServerClient() {
  const env = requireSupabaseEnv(); const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, { cookies: { getAll() { return cookieStore.getAll(); }, setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot set cookies; proxy refresh handles it. */ } } } });
}
export async function getSupabaseUser() { const client = await getSupabaseServerClient(); const { data, error } = await client.auth.getUser(); return error ? null : data.user; }
