type PublicEnv = { supabaseUrl?: string; supabaseAnonKey?: string; authEnabled: boolean; isSupabaseConfigured: boolean };

export function getPublicEnv(): PublicEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const authEnabled = process.env.NEXT_PUBLIC_FAUST_AUTH_ENABLED === "true";
  return { supabaseUrl, supabaseAnonKey, authEnabled, isSupabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey) };
}

export function requireSupabaseEnv() {
  const env = getPublicEnv();
  if (!env.isSupabaseConfigured) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return { url: env.supabaseUrl!, anonKey: env.supabaseAnonKey! };
}

export function isProductionAuthEnabled() { const env = getPublicEnv(); return env.authEnabled && env.isSupabaseConfigured; }
