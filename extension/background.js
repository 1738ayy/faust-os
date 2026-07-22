const DEFAULTS = { faustBaseUrl: "http://localhost:3000", environment: "local", extensionVersion: "2.0.0-ux", deviceName: "Faust Chrome Extension" };

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
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Faust-Extension-Version": config.extensionVersion, ...(session.deviceId ? { "X-Faust-Device-Id": session.deviceId } : {}), ...(session.extensionToken ? { "X-Faust-Extension-Token": session.extensionToken } : {}), "X-Faust-Nonce": nonce },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Faust request failed: ${response.status}`);
  return data;
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 8000);
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function openAnalyzerWithHandoff(product, scan, analysis, warnings = []) {
  const config = await settings();
  const tab = await chrome.tabs.create({ url: `${config.faustBaseUrl}/opportunity-analyzer?source=extension-import&handoff=extension` });
  if (!tab.id) return;
  await waitForTabComplete(tab.id);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (payload) => {
      window.localStorage.setItem("faust.latestExtensionScan", JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("faust-extension-scan-ready"));
    },
    args: [{ product, scan, analysis, warnings, createdAt: new Date().toISOString() }],
  });
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

async function rememberActivity(entry) {
  const existing = await chrome.storage.local.get(["importHistory"]);
  const history = Array.isArray(existing.importHistory) ? existing.importHistory : [];
  await chrome.storage.local.set({ importHistory: [{ id: crypto.randomUUID(), at: new Date().toISOString(), ...entry }, ...history].slice(0, 20) });
}

async function scanActiveSourceProduct() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await ensureSourceScanner(tab);
  const product = await chrome.tabs.sendMessage(tab.id, { action: "scan-current-product" });
  await chrome.storage.session.set({ lastProduct: product });
  return product;
}

function tabHost(tab) {
  try {
    return tab?.url ? new URL(tab.url).hostname.toLowerCase() : "";
  } catch {
    return "";
  }
}

function isSourceProductTab(tab) {
  const host = tabHost(tab);
  return host.endsWith("superbuy.com") || host.endsWith("1688.com");
}

function isMarketplaceTab(tab) {
  const host = tabHost(tab);
  return ["depop.com", "ebay.com", "etsy.com", "mercari.com", "poshmark.com"].some((domain) => host.endsWith(domain));
}

async function injectScripts(tabId, files) {
  await chrome.scripting.executeScript({ target: { tabId }, files });
}

async function ensureSourceScanner(tab) {
  if (!tab?.id) throw new Error("Open a source product tab first.");
  if (!isSourceProductTab(tab)) throw new Error("Open a Superbuy or 1688 product page before scanning.");
  await injectScripts(tab.id, ["extractors/product.js", "utils/send.js", "content.js"]);
}

async function ensureMarketplaceAssistant(tab) {
  if (!tab?.id) throw new Error("Open a marketplace listing tab first.");
  if (!isMarketplaceTab(tab)) throw new Error("Open a supported marketplace listing page before filling.");
  await injectScripts(tab.id, ["adapters.js", "marketplace-content.js"]);
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
      const response = await fetch(`${config.faustBaseUrl}/api/extension/actions`, { credentials: "include" }).then((item) => item.json());
      sendResponse({ ok: true, config, local, response });
      return;
    }
    if (message.type === "FAUST_REGISTER_DEVICE") {
      const response = await registerDevice();
      sendResponse({ ok: true, response });
      return;
    }
    if (message.type === "FAUST_SCAN_PRODUCT") {
      const product = await scanActiveSourceProduct();
      const scan = await callFaust("/api/extension/scan", { payload: product });
      const analysis = await callFaust("/api/extension/analyze", { product });
      await rememberActivity({ kind: "scan", title: product.title || "Untitled product", image: product.images?.[0], sourceUrl: product.original1688Url || product.superbuyUrl });
      sendResponse({ ok: true, product, scan, analysis });
      return;
    }
    if (message.type === "FAUST_IMPORT_TO_ANALYZER") {
      const product = message.product || await scanActiveSourceProduct();
      await chrome.storage.session.set({ lastProduct: product });
      const warnings = [];
      let scan = null;
      let analysis = null;
      try {
        scan = await callFaust("/api/extension/scan", { payload: product });
      } catch (error) {
        warnings.push(`Faust saved a browser handoff because server scan save was unavailable: ${error.message || "unknown error"}`);
      }
      try {
        analysis = await callFaust("/api/extension/analyze", { product });
      } catch (error) {
        warnings.push(`Faust will calculate in the analyzer because extension analysis was unavailable: ${error.message || "unknown error"}`);
      }
      await openAnalyzerWithHandoff(product, scan, analysis, warnings);
      await rememberActivity({ kind: "import", title: product.title || "Untitled product", image: product.images?.[0], sourceUrl: product.original1688Url || product.superbuyUrl });
      sendResponse({ ok: true, product, scan, analysis, warnings });
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
      await ensureMarketplaceAssistant(tab);
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
      const local = await chrome.storage.local.get(["importHistory", "deviceId", "tokenExpiresAt"]);
      sendResponse({ ok: true, session: await chrome.storage.session.get(["lastProduct", "lastImport"]), local, config: await settings() });
      return;
    }
  })().catch((error) => sendResponse({ ok: false, error: error.message || "Extension action failed." }));
  return true;
});
