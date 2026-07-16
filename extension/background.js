const DEFAULTS = { faustBaseUrl: "http://localhost:3000", environment: "local", extensionVersion: "1.1.0-phase2", deviceName: "Faust Chrome Extension" };

async function settings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function callFaust(path, body) {
  const config = await settings();
  const session = await chrome.storage.local.get(["deviceId", "extensionToken", "tokenExpiresAt"]);
  const nonce = crypto.randomUUID();
  const response = await fetch(`${config.faustBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Faust-Extension-Version": config.extensionVersion, ...(session.deviceId ? { "X-Faust-Device-Id": session.deviceId } : {}), ...(session.extensionToken ? { "X-Faust-Extension-Token": session.extensionToken } : {}), "X-Faust-Nonce": nonce },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Faust request failed: ${response.status}`);
  return data;
}

async function registerDevice() {
  const config = await settings();
  const response = await fetch(`${config.faustBaseUrl}/api/extension/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Faust-Extension-Version": config.extensionVersion },
    body: JSON.stringify({ deviceName: config.deviceName, browser: navigator.userAgent, environment: config.environment, version: config.extensionVersion, permissions: chrome.runtime.getManifest().permissions || [], idempotencyKey: crypto.randomUUID() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.actionResult?.token) throw new Error(data.message || "Could not register Faust extension device.");
  await chrome.storage.local.set({ deviceId: data.actionResult.deviceId, extensionToken: data.actionResult.token, tokenExpiresAt: data.actionResult.expiresAt });
  return data;
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.sync.set(await settings());
  await registerDevice().catch(() => undefined);
  if (chrome.sidePanel?.setPanelBehavior) await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "FAUST_STATUS") {
      const config = await settings();
      const local = await chrome.storage.local.get(["deviceId", "tokenExpiresAt"]);
      const response = await fetch(`${config.faustBaseUrl}/api/extension/actions`).then((item) => item.json());
      sendResponse({ ok: true, config, local, response });
      return;
    }
    if (message.type === "FAUST_REGISTER_DEVICE") {
      const response = await registerDevice();
      sendResponse({ ok: true, response });
      return;
    }
    if (message.type === "FAUST_SCAN_PRODUCT") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("Open a source product tab first.");
      const product = await chrome.tabs.sendMessage(tab.id, { action: "scan-current-product" });
      await chrome.storage.session.set({ lastProduct: product });
      const scan = await callFaust("/api/extension/scan", { payload: product });
      const analysis = await callFaust("/api/extension/analyze", { product });
      sendResponse({ ok: true, product, scan, analysis });
      return;
    }
    if (message.type === "FAUST_IMPORT_LAST_PRODUCT") {
      const { lastProduct } = await chrome.storage.session.get("lastProduct");
      if (!lastProduct) throw new Error("Scan a source product before importing.");
      const result = await callFaust("/api/extension/import", { product: lastProduct, approved: true, idempotencyKey: crypto.randomUUID() });
      await chrome.storage.session.set({ lastImport: result });
      sendResponse({ ok: true, result });
      return;
    }
    if (message.type === "FAUST_CONFIRM_PUBLISH") {
      const result = await callFaust("/api/extension/confirm", message.payload);
      sendResponse({ ok: true, result });
      return;
    }
    if (message.type === "FAUST_GUIDED_PUBLISH") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("Open a marketplace listing tab first.");
      const status = await chrome.tabs.sendMessage(tab.id, { type: "FAUST_MARKETPLACE_STATUS" });
      const preview = await chrome.tabs.sendMessage(tab.id, { type: "FAUST_FILL_MARKETPLACE_FORM", mapping: message.mapping, dryRun: message.dryRun !== false });
      sendResponse({ ok: true, status, preview });
      return;
    }
    if (message.type === "FAUST_SYNC_DRAFT") {
      const path = message.mode === "pause" ? "/api/extension/pause" : message.mode === "delist" ? "/api/extension/delist" : "/api/extension/sync";
      const result = await callFaust(path, message.payload);
      sendResponse({ ok: true, result });
      return;
    }
    if (message.type === "FAUST_REPORT_ERROR") {
      const result = await callFaust("/api/extension/error", message.payload);
      sendResponse({ ok: true, result });
      return;
    }
    if (message.type === "FAUST_GET_SESSION_STATE") {
      sendResponse({ ok: true, session: await chrome.storage.session.get(["lastProduct", "lastImport"]), config: await settings() });
      return;
    }
  })().catch((error) => sendResponse({ ok: false, error: error.message || "Extension action failed." }));
  return true;
});
