import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getActiveBusinessId } from "@/services/business/repository";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { readProductionEnv, storageBuckets } from "@/lib/production-config";

const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Image unavailable"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#0b1017"/><stop offset="1" stop-color="#1f2b3f"/></linearGradient></defs><rect width="160" height="160" rx="28" fill="url(#bg)"/><path d="M48 96c18-28 28-18 39-36 10 19 25 22 30 44-20 11-47 12-69-8Z" fill="#66708d" opacity=".72"/><circle cx="106" cy="54" r="11" fill="#c8d2e6" opacity=".8"/><text x="80" y="128" text-anchor="middle" fill="#c8d2e6" font-family="Arial, sans-serif" font-size="12" opacity=".84">Image unavailable</text></svg>`;
const storageRoot = path.join(process.cwd(), ".faust", "image-storage");
const maxBytes = 8 * 1024 * 1024;
const contentTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const extensionTypes = new Map([...contentTypes.entries()].map(([type, extension]) => [extension, type]));

function placeholder() {
  return new NextResponse(placeholderSvg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function safeKey(value: string | null) {
  if (!value || value.includes("..") || path.isAbsolute(value) || !/^[a-z0-9/_-]+\.(jpg|png|webp)$/i.test(value)) return undefined;
  return value;
}

function safeStorageKey(value: string | null) {
  if (!value || value.includes("..") || !/^[a-z0-9_-]+\/[a-z0-9/_-]+\.(jpg|png|webp)$/i.test(value)) return undefined;
  const [bucket, ...parts] = value.split("/");
  const key = parts.join("/");
  if (!bucket || !key) return undefined;
  return { bucket, key };
}

async function storedImage(key: string) {
  const safe = safeKey(key);
  if (!safe) return placeholder();
  const filePath = path.join(storageRoot, safe);
  if (!filePath.startsWith(storageRoot)) return placeholder();
  try {
    const body = await fs.readFile(filePath);
    const extension = path.extname(filePath).slice(1).toLowerCase();
    return new NextResponse(body, {
      headers: {
        "Content-Type": extensionTypes.get(extension) || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return placeholder();
  }
}

async function storedSupabaseImage(storageKey: string) {
  const safe = safeStorageKey(storageKey);
  if (!safe) return placeholder();
  const env = readProductionEnv();
  const publicEnv = getPublicEnv();
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return placeholder();
  try {
    const client = env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(publicEnv.supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : await getSupabaseServerClient();
    const { data, error } = await client.storage.from(safe.bucket).download(safe.key);
    if (error || !data) return placeholder();
    return new NextResponse(Buffer.from(await data.arrayBuffer()), {
      headers: {
        "Content-Type": data.type || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return placeholder();
  }
}

async function uploadLocalImage(buffer: Buffer, extension: string, contentType: string) {
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const key = `product-images/${new Date().toISOString().slice(0, 10)}/${hash}-${randomUUID()}.${extension}`;
  const destination = path.join(storageRoot, key);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, buffer);
  return {
    storageKey: key,
    url: `/api/import-image?key=${encodeURIComponent(key)}`,
    contentType,
    size: buffer.length,
    provider: "local",
  };
}

async function uploadSupabaseImage(buffer: Buffer, extension: string, contentType: string) {
  const env = readProductionEnv();
  const publicEnv = getPublicEnv();
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return uploadLocalImage(buffer, extension, contentType);
  const businessId = await getActiveBusinessId().catch(() => undefined);
  if (!businessId) throw new Error("Choose a business workspace before uploading product photos.");
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const bucket = storageBuckets(env)["product-images"];
  const key = `products/${businessId}/${new Date().toISOString().slice(0, 10)}/${hash}-${randomUUID()}.${extension}`;
  const client = env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(publicEnv.supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : await getSupabaseServerClient();
  const { error } = await client.storage.from(bucket).upload(key, buffer, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = client.storage.from(bucket).getPublicUrl(key);
  return {
    storageKey: `${bucket}/${key}`,
    storageUrl: data.publicUrl,
    url: `/api/import-image?storageKey=${encodeURIComponent(`${bucket}/${key}`)}`,
    contentType,
    size: buffer.length,
    provider: "supabase",
  };
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const key = search.get("key");
  if (key) return storedImage(key);
  const storageKey = search.get("storageKey");
  if (storageKey) return storedSupabaseImage(storageKey);

  const urls = search.getAll("url");
  for (const url of urls) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) continue;

    try {
      const response = await fetch(parsed, {
        headers: {
          "User-Agent": "Mozilla/5.0 FaustOS/1.0 image-preview",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Referer": "https://www.superbuy.com/",
        },
        signal: AbortSignal.timeout(8000),
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.startsWith("image/")) continue;
      return new NextResponse(response.body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    } catch {
      continue;
    }
  }
  return placeholder();
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "Choose an image before saving." }, { status: 400 });
    const contentType = file.type || "application/octet-stream";
    const extension = contentTypes.get(contentType);
    if (!extension) return NextResponse.json({ ok: false, message: "Use JPG, PNG, or WEBP images." }, { status: 400 });
    if (file.size > maxBytes) return NextResponse.json({ ok: false, message: "Each image must be 8 MB or smaller." }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const env = readProductionEnv();
    const result = env.FAUST_ENV === "local" && process.env.NEXT_PUBLIC_FAUST_AUTH_ENABLED !== "true"
      ? await uploadLocalImage(buffer, extension, contentType)
      : await uploadSupabaseImage(buffer, extension, contentType);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[faust:image-upload]", error);
    return NextResponse.json({ ok: false, message: "This image could not be uploaded. Please retry before publishing." }, { status: 500 });
  }
}
