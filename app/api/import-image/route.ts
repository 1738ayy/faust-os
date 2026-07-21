import { NextResponse } from "next/server";

const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Image unavailable"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#0b1017"/><stop offset="1" stop-color="#1f2b3f"/></linearGradient></defs><rect width="160" height="160" rx="28" fill="url(#bg)"/><path d="M48 96c18-28 28-18 39-36 10 19 25 22 30 44-20 11-47 12-69-8Z" fill="#66708d" opacity=".72"/><circle cx="106" cy="54" r="11" fill="#c8d2e6" opacity=".8"/><text x="80" y="128" text-anchor="middle" fill="#c8d2e6" font-family="Arial, sans-serif" font-size="12" opacity=".84">Image unavailable</text></svg>`;

function placeholder() {
  return new NextResponse(placeholderSvg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function GET(request: Request) {
  const urls = new URL(request.url).searchParams.getAll("url");
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
