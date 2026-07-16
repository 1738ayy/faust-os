import { createClient } from "@supabase/supabase-js";

const required = [
  "FAUST_ENV",
  "STAGING_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_TEST_OWNER_EMAIL",
  "SUPABASE_TEST_OWNER_PASSWORD",
];

function fail(message, detail = {}) {
  console.error(JSON.stringify({ ok: false, message, ...detail }, null, 2));
  process.exit(1);
}

function log(step, detail = {}) {
  console.log(JSON.stringify({ ok: true, step, ...detail }, null, 2));
}

const missing = required.filter((key) => !process.env[key]);
if (missing.length) fail("Missing required staging values.", { missing });
if (process.env.FAUST_ENV !== "staging") fail("FAUST_ENV must be staging for this check.", { FAUST_ENV: process.env.FAUST_ENV });
if (process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) fail("Service role key must not equal anon key.");
if (Object.keys(process.env).some((key) => key.startsWith("NEXT_PUBLIC_") && /SERVICE|SECRET|PRIVATE|TOKEN/i.test(key))) fail("A server-only secret appears to be exposed through NEXT_PUBLIC_*.");

const appUrl = process.env.STAGING_APP_URL.replace(/\/$/, "");
const healthResponse = await fetch(`${appUrl}/api/health`);
const health = await healthResponse.json().catch(() => ({}));
if (!healthResponse.ok) fail("/api/health is not green enough for staging.", { status: healthResponse.status, health });
log("health", { status: health.status, checks: Object.fromEntries(Object.entries(health.checks || {}).map(([key, value]) => [key, value.status])) });

const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error: authError } = await anonClient.auth.signInWithPassword({ email: process.env.SUPABASE_TEST_OWNER_EMAIL, password: process.env.SUPABASE_TEST_OWNER_PASSWORD });
if (authError || !auth.user) fail("Staging owner sign-in failed.", { error: authError?.message });
const { data: memberships, error: membershipError } = await anonClient.from("business_members").select("business_id,role").limit(5);
if (membershipError) fail("RLS membership read failed for staging owner.", { error: membershipError.message });
log("supabase-auth-rls", { userId: auth.user.id, membershipCount: memberships?.length || 0 });

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const bucket = process.env.SUPABASE_STORAGE_BUCKET_EXTENSION_LOGS || "staging-extension-logs";
const path = `staging-probes/${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
const body = JSON.stringify({ probe: "faust-staging-storage", createdAt: new Date().toISOString() });
const { error: uploadError } = await serviceClient.storage.from(bucket).upload(path, new Blob([body], { type: "application/json" }), { contentType: "application/json", upsert: false });
if (uploadError) fail("Storage upload probe failed.", { bucket, path, error: uploadError.message });
const { data: download, error: downloadError } = await serviceClient.storage.from(bucket).download(path);
if (downloadError || !download) fail("Storage download probe failed.", { bucket, path, error: downloadError?.message });
const downloaded = await download.text();
if (!downloaded.includes("faust-staging-storage")) fail("Storage probe content did not round-trip.", { bucket, path });
await serviceClient.storage.from(bucket).remove([path]);
log("storage-upload-download", { bucket, path });

const aiProvider = process.env.AI_PROVIDER || "deterministic";
const aiConfigured = aiProvider === "deterministic" || Boolean(aiProvider === "openai" ? process.env.OPENAI_API_KEY : aiProvider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY);
if (!aiConfigured) fail("Selected AI provider is missing credentials.", { aiProvider });
log("ai-provider", { provider: aiProvider, credentialPresent: aiProvider === "deterministic" ? "not_required" : true, liveModelCall: "manual_verification_required_in_staging_ui" });

const shippingProvider = process.env.SHIPPING_PROVIDER || "local_mock";
const shippingConfigured = shippingProvider === "local_mock" || Boolean(shippingProvider === "easypost" ? process.env.EASYPOST_API_KEY : process.env.SHIPPO_API_KEY);
if (!shippingConfigured) fail("Selected shipping provider is missing sandbox credentials.", { shippingProvider });
log("shipping-provider", { provider: shippingProvider, credentialPresent: shippingProvider === "local_mock" ? "not_required" : true, sandboxLabelFlow: "manual_verification_required_in_staging_ui" });

log("staging-live-check-complete", { appUrl, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, nextManualStep: "Run the end-to-end staging scenario from docs/staging-live-connection-runbook.md." });
