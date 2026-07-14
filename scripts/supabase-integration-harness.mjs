import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_TEST_OWNER_EMAIL", "SUPABASE_TEST_OWNER_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) { console.error(`Missing integration-test environment values: ${missing.join(", ")}`); process.exit(2); }
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data, error } = await client.auth.signInWithPassword({ email: process.env.SUPABASE_TEST_OWNER_EMAIL, password: process.env.SUPABASE_TEST_OWNER_PASSWORD });
if (error || !data.user) { console.error(error?.message || "Test owner could not sign in."); process.exit(1); }
const { error: membershipError } = await client.from("business_members").select("business_id,role").limit(1);
if (membershipError) { console.error(`RLS/auth integration check failed: ${membershipError.message}`); process.exit(1); }
console.log("Supabase authenticated membership query passed. Add separate owner/admin/viewer test users to extend live RLS coverage.");
