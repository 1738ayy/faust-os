"use client";
import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | undefined;
export function getSupabaseBrowserClient() { if (!client) { const env = requireSupabaseEnv(); client = createBrowserClient(env.url, env.anonKey); } return client; }
