import { z } from "zod";

export const storageBucketKeys = [
  "product-images",
  "receipts",
  "shipping-labels",
  "packing-photos",
  "extension-screenshots",
  "extension-dom-snapshots",
  "extension-logs",
  "publish-evidence",
] as const;

export type FaustEnvironment = "local" | "staging" | "production";
export type ProductionConfigStatus = "ready" | "missing_required" | "local_unconfigured";

const booleanFromEnv = z.preprocess((value) => value === true || value === "true", z.boolean());
const optionalUrl = z.string().url().optional().or(z.literal("").transform(() => undefined));

export const productionEnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  FAUST_ENV: z.enum(["local", "staging", "production"]).default("local"),
  NEXT_PUBLIC_FAUST_AUTH_ENABLED: booleanFromEnv.default(false),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined)),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined)),
  SUPABASE_STORAGE_BUCKET_PRODUCT_IMAGES: z.string().trim().min(1).default("product-images"),
  SUPABASE_STORAGE_BUCKET_RECEIPTS: z.string().trim().min(1).default("receipts"),
  SUPABASE_STORAGE_BUCKET_LABELS: z.string().trim().min(1).default("shipping-labels"),
  SUPABASE_STORAGE_BUCKET_PACKING_PHOTOS: z.string().trim().min(1).default("packing-photos"),
  SUPABASE_STORAGE_BUCKET_EXTENSION_SCREENSHOTS: z.string().trim().min(1).default("extension-screenshots"),
  SUPABASE_STORAGE_BUCKET_EXTENSION_DOM_SNAPSHOTS: z.string().trim().min(1).default("extension-dom-snapshots"),
  SUPABASE_STORAGE_BUCKET_EXTENSION_LOGS: z.string().trim().min(1).default("extension-logs"),
  SUPABASE_STORAGE_BUCKET_PUBLISH_EVIDENCE: z.string().trim().min(1).default("publish-evidence"),
  AUTOMATION_WORKER_URL: optionalUrl,
  AUTOMATION_WORKER_ID: z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined)),
  AUTOMATION_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(25).default(4),
  AUTOMATION_WORKER_POLL_MS: z.coerce.number().int().min(250).max(60000).default(5000),
  AUTOMATION_WORKER_LEASE_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  FAUST_ALLOWED_EXTENSION_ORIGINS: z.string().trim().default("chrome-extension://*,http://localhost:3000,https://*.faust.local"),
  FAUST_EXTENSION_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(3600),
  STAGING_APP_URL: optionalUrl,
  AI_PROVIDER: z.enum(["deterministic", "openai", "anthropic", "gemini"]).default("deterministic"),
  OPENAI_API_KEY: z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined)),
  ANTHROPIC_API_KEY: z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined)),
  GEMINI_API_KEY: z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined)),
  SHIPPING_PROVIDER: z.enum(["local_mock", "easypost", "shippo"]).default("local_mock"),
  EASYPOST_API_KEY: z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined)),
  SHIPPO_API_KEY: z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined)),
});

export type ProductionEnv = z.infer<typeof productionEnvSchema>;

export function readProductionEnv(source: Record<string, string | undefined> = process.env) {
  return productionEnvSchema.parse(source);
}

export function storageBuckets(env: ProductionEnv = readProductionEnv()) {
  return {
    "product-images": env.SUPABASE_STORAGE_BUCKET_PRODUCT_IMAGES,
    receipts: env.SUPABASE_STORAGE_BUCKET_RECEIPTS,
    "shipping-labels": env.SUPABASE_STORAGE_BUCKET_LABELS,
    "packing-photos": env.SUPABASE_STORAGE_BUCKET_PACKING_PHOTOS,
    "extension-screenshots": env.SUPABASE_STORAGE_BUCKET_EXTENSION_SCREENSHOTS,
    "extension-dom-snapshots": env.SUPABASE_STORAGE_BUCKET_EXTENSION_DOM_SNAPSHOTS,
    "extension-logs": env.SUPABASE_STORAGE_BUCKET_EXTENSION_LOGS,
    "publish-evidence": env.SUPABASE_STORAGE_BUCKET_PUBLISH_EVIDENCE,
  } satisfies Record<(typeof storageBucketKeys)[number], string>;
}

export function validateProductionReadiness(env: ProductionEnv = readProductionEnv()) {
  const missing: string[] = [];
  const warnings: string[] = [];
  const isProdLike = env.FAUST_ENV === "staging" || env.FAUST_ENV === "production";
  if (isProdLike || env.NEXT_PUBLIC_FAUST_AUTH_ENABLED) {
    if (!env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (env.FAUST_ENV === "production" && !env.SUPABASE_SERVICE_ROLE_KEY) warnings.push("SUPABASE_SERVICE_ROLE_KEY is not set; server-side bootstrap, storage provisioning, and workers must use platform-managed service credentials instead.");
  if (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY_must_not_equal_anon_key");
  if (env.FAUST_ENV === "production" && env.AUTOMATION_WORKER_URL?.includes("localhost")) warnings.push("AUTOMATION_WORKER_URL points at localhost in production.");
  if (env.FAUST_ENV === "staging" && !env.STAGING_APP_URL) warnings.push("STAGING_APP_URL is not set; remote health verification cannot run yet.");
  if (env.AI_PROVIDER === "openai" && !env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (env.AI_PROVIDER === "gemini" && !env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  if (env.SHIPPING_PROVIDER === "easypost" && !env.EASYPOST_API_KEY) missing.push("EASYPOST_API_KEY");
  if (env.SHIPPING_PROVIDER === "shippo" && !env.SHIPPO_API_KEY) missing.push("SHIPPO_API_KEY");
  return { status: missing.length ? "missing_required" as const : env.FAUST_ENV === "local" && !env.NEXT_PUBLIC_FAUST_AUTH_ENABLED ? "local_unconfigured" as const : "ready" as const, environment: env.FAUST_ENV, missing, warnings, publicClientConfigured: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY), serviceRoleServerOnly: Boolean(env.SUPABASE_SERVICE_ROLE_KEY) };
}

export function providerReadiness(env: ProductionEnv = readProductionEnv()) {
  return {
    ai: {
      selected: env.AI_PROVIDER,
      configured: env.AI_PROVIDER === "deterministic" || Boolean(env.AI_PROVIDER === "openai" ? env.OPENAI_API_KEY : env.AI_PROVIDER === "anthropic" ? env.ANTHROPIC_API_KEY : env.GEMINI_API_KEY),
      liveActionExecution: "approval_required",
    },
    shipping: {
      selected: env.SHIPPING_PROVIDER,
      configured: env.SHIPPING_PROVIDER === "local_mock" || Boolean(env.SHIPPING_PROVIDER === "easypost" ? env.EASYPOST_API_KEY : env.SHIPPO_API_KEY),
      reachability: env.SHIPPING_PROVIDER === "local_mock" ? "mock" : "not_checked",
      mockFallback: env.SHIPPING_PROVIDER === "local_mock",
      mode: env.SHIPPING_PROVIDER === "local_mock" ? "mock" : env.SHIPPING_PROVIDER === "easypost" ? "easypost_sandbox" : "sandbox_required",
    },
    marketplaces: {
      selected: "extension-assisted single test channel only",
      allFiveLiveCredentials: "not_connected_by_design",
    },
  };
}

export function assertNoServerSecretsInPublicEnv(source: Record<string, string | undefined> = process.env) {
  const leaked = Object.keys(source).filter((key) => key.startsWith("NEXT_PUBLIC_") && /SERVICE|SECRET|PRIVATE|TOKEN/i.test(key));
  if (leaked.length) throw new Error(`Server-only secret names must not be public: ${leaked.join(", ")}`);
  return true;
}
