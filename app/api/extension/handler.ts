import { NextResponse } from "next/server";
import { extensionActionSchema } from "@/lib/validation/requests";
import { extensionVersion } from "@/lib/browser-extension";
import { getOperatingData, mutateBrowserExtension, snapshot } from "@/services/operating-system/repository";
import type { ExtensionAction } from "@/lib/browser-extension";

export const extensionCorsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Faust-Extension-Version",
};

function cors(request?: Request) {
  const origin = request?.headers.get("origin") || "";
  const allowed = origin === "http://localhost:3000" || origin.startsWith("chrome-extension://") || /^https:\/\/([\w-]+\.)?faust\.local$/.test(origin);
  return { ...extensionCorsHeaders, "Access-Control-Allow-Origin": allowed ? origin : "http://localhost:3000", "Vary": "Origin" };
}

export function extensionOptions() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function extensionStatus() {
  const data = await getOperatingData();
  return NextResponse.json({ ok: true, extensionVersion, faust: { mode: data.mode, updatedAt: data.updatedAt }, session: "browser-session", allowedOrigins: ["superbuy.com", "1688.com", "depop.com", "ebay.com", "etsy.com", "mercari.com", "poshmark.com"] }, { headers: cors() });
}

export async function extensionPost(request: Request, forcedAction?: ExtensionAction["action"]) {
  try {
    const body = await request.json();
    const input = extensionActionSchema.parse(forcedAction ? { ...body, action: forcedAction } : body) as ExtensionAction;
    const result = await mutateBrowserExtension(input);
    return NextResponse.json({ ok: true, extensionVersion, actionResult: result.actionResult, ...snapshot(result.data) }, { headers: cors(request) });
  } catch (error) {
    return NextResponse.json({ ok: false, extensionVersion, message: error instanceof Error ? error.message : "Extension request failed." }, { status: 400, headers: cors(request) });
  }
}
