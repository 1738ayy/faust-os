import { NextResponse } from "next/server";
import { extensionActionSchema } from "@/lib/validation/requests";
import { extensionConnectionSummary, extensionVersion, hashExtensionToken } from "@/lib/browser-extension";
import { getOperatingData, mutateBrowserExtension, snapshot } from "@/services/operating-system/repository";
import type { ExtensionAction } from "@/lib/browser-extension";

export const extensionCorsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Faust-Extension-Version, X-Faust-Device-Id, X-Faust-Extension-Token, X-Faust-Nonce",
};

function cors(request?: Request) {
  const origin = request?.headers.get("origin") || "";
  const allowed = origin === "http://localhost:3000" || origin.startsWith("chrome-extension://") || /^https:\/\/([\w-]+\.)?faust\.local$/.test(origin);
  return { ...extensionCorsHeaders, "Access-Control-Allow-Origin": allowed ? origin : "http://localhost:3000", "Vary": "Origin" };
}

export function extensionOptions(request?: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request) });
}

export async function extensionStatus(request?: Request) {
  const data = await getOperatingData();
  return NextResponse.json({ ok: true, extensionVersion, faust: { mode: data.mode, updatedAt: data.updatedAt }, session: "device-registration-required", extension: extensionConnectionSummary(data), allowedOrigins: ["superbuy.com", "1688.com", "depop.com", "ebay.com", "etsy.com", "mercari.com", "poshmark.com"] }, { headers: cors(request) });
}

function validateExtensionSession(data: Awaited<ReturnType<typeof getOperatingData>>, request: Request, action: ExtensionAction["action"]) {
  if (action === "register-device") return {};
  const activeDevices = data.extensionDevices?.filter((device) => device.status === "active") || [];
  if (!activeDevices.length) return {};
  const deviceId = request.headers.get("x-faust-device-id") || "";
  const token = request.headers.get("x-faust-extension-token") || "";
  const nonce = request.headers.get("x-faust-nonce") || "";
  if (!deviceId || !token || !nonce) throw new Error("Extension device token and nonce are required.");
  const device = activeDevices.find((entry) => entry.id === deviceId);
  if (!device) throw new Error("Extension device is not registered or has been revoked.");
  const session = data.extensionSessions?.find((entry) => entry.deviceId === deviceId && !entry.revokedAt && entry.tokenHash === hashExtensionToken(token));
  if (!session) throw new Error("Invalid extension token.");
  if (new Date(session.expiresAt).getTime() <= Date.now()) throw new Error("Extension token expired. Reconnect the extension.");
  if (session.usedNonces.includes(nonce)) throw new Error("Replay detected for extension request.");
  return { deviceId, nonce };
}

export async function extensionPost(request: Request, forcedAction?: ExtensionAction["action"]) {
  try {
    const body = await request.json();
    const input = extensionActionSchema.parse(forcedAction ? { ...body, action: forcedAction } : body) as ExtensionAction;
    const data = await getOperatingData();
    const session = validateExtensionSession(data, request, input.action);
    const result = await mutateBrowserExtension(input, session);
    return NextResponse.json({ ok: true, extensionVersion, actionResult: result.actionResult, ...snapshot(result.data) }, { headers: cors(request) });
  } catch (error) {
    return NextResponse.json({ ok: false, extensionVersion, message: error instanceof Error ? error.message : "Extension request failed." }, { status: 400, headers: cors(request) });
  }
}
