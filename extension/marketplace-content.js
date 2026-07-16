(() => {
  const adapter = globalThis.faustAdapterForHost?.();

  function findBySelectors(selectors = []) {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) return { element, selector, strategy: "css" };
      } catch {
        // Invalid live-site selectors should be reported as field failures, not crash the whole run.
      }
    }
    return null;
  }

  function findByLabel(labels = []) {
    const labelNodes = Array.from(document.querySelectorAll("label, span, div, p, button"));
    for (const label of labels) {
      const node = labelNodes.find((entry) => entry.textContent?.trim().toLowerCase() === label.toLowerCase() || entry.textContent?.toLowerCase().includes(label.toLowerCase()));
      const controlId = node?.getAttribute?.("for");
      const byFor = controlId ? document.getElementById(controlId) : null;
      if (byFor) return { element: byFor, selector: `label:${label}`, strategy: "label" };
      const nearby = node?.closest?.("div, section, fieldset")?.querySelector?.("input, textarea, select, [contenteditable='true']");
      if (nearby) return { element: nearby, selector: `near-label:${label}`, strategy: "label" };
    }
    return null;
  }

  function setValue(element, value) {
    if (!element || value === undefined || value === null) return false;
    element.scrollIntoView({ block: "center", inline: "center" });
    element.classList.add("faust-field-highlight");
    element.focus();
    if (element.isContentEditable) element.textContent = String(value);
    else element.value = String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function detectLoginState() {
    if (!adapter) return { state: "unsupported", reason: "No marketplace adapter for this host." };
    const loggedOut = findBySelectors(adapter.login.out);
    if (loggedOut) return { state: "logged_out", selector: loggedOut.selector };
    const loggedIn = findBySelectors(adapter.login.in);
    return loggedIn ? { state: "logged_in", selector: loggedIn.selector } : { state: "unknown", reason: "No login-state selector matched." };
  }

  function pageFingerprint() {
    if (!adapter) return { status: "unsupported" };
    const present = adapter.fingerprint.selectors.filter((selector) => {
      try { return Boolean(document.querySelector(selector)); } catch { return false; }
    });
    const text = document.body?.innerText || "";
    const expectedTextFound = adapter.fingerprint.text.filter((item) => text.toLowerCase().includes(item.toLowerCase()));
    return { status: present.length && expectedTextFound.length ? "recognized" : "changed", adapterVersion: adapter.version, presentSelectors: present, expectedTextFound };
  }

  function errorState() {
    if (!adapter) return { classification: "permanent", messages: ["Unsupported marketplace."] };
    const messages = adapter.errors.selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).map((element) => element.textContent?.trim()).filter(Boolean));
    const joined = messages.join(" ");
    const retryable = adapter.errors.retryable.some((pattern) => pattern.test(joined));
    const permanent = adapter.errors.permanent.some((pattern) => pattern.test(joined));
    return { classification: retryable ? "retryable" : permanent ? "permanent" : "unknown", messages };
  }

  function domSnapshotBoundary() {
    const form = document.querySelector("form") || document.querySelector("main") || document.body;
    const text = (form?.outerHTML || "").slice(0, 12000);
    let hash = 0;
    for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return { hash: hash.toString(16), length: text.length };
  }

  function fillFields(mapping = {}, dryRun = true) {
    if (!adapter) throw new Error("Unsupported marketplace page.");
    const filled = {};
    const blocked = [];
    for (const [field, config] of Object.entries(adapter.fields)) {
      const value = mapping[field];
      const match = findBySelectors(config.primary) || findBySelectors(config.fallback) || findByLabel(config.labels);
      if (!match) {
        if (config.required) blocked.push({ field, reason: "selector_not_found", required: true, selectors: [...config.primary, ...config.fallback], labels: config.labels });
        else filled[field] = { status: "unsupported", reason: "optional_selector_not_found" };
        continue;
      }
      if (dryRun) {
        match.element.classList.add("faust-field-highlight");
        filled[field] = { status: "preview", selector: match.selector, strategy: match.strategy };
      } else {
        const ok = setValue(match.element, value);
        filled[field] = { status: ok ? "filled" : "failed", selector: match.selector, strategy: match.strategy };
        if (!ok && config.required) blocked.push({ field, reason: "value_not_applied", selector: match.selector });
      }
    }
    return { filled, blocked };
  }

  function confirmation() {
    if (!adapter) return { found: false };
    for (const selector of adapter.confirmation.selectors) {
      const element = document.querySelector(selector);
      const href = element?.href || element?.querySelector?.("a")?.href || location.href;
      if (element) {
        const idMatch = adapter.confirmation.idPatterns.map((pattern) => href.match(pattern)?.[1]).find(Boolean);
        return { found: true, externalListingId: idMatch || href.split("/").filter(Boolean).at(-1), externalUrl: href, selector };
      }
    }
    return { found: false };
  }

  function injectStyle() {
    if (document.getElementById("faust-extension-style")) return;
    const style = document.createElement("style");
    style.id = "faust-extension-style";
    style.textContent = ".faust-field-highlight{outline:3px solid #22c55e!important; box-shadow:0 0 0 5px rgba(34,197,94,.25)!important}";
    document.documentElement.appendChild(style);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!String(message.type || "").startsWith("FAUST_")) return;
    try {
      injectStyle();
      if (message.type === "FAUST_MARKETPLACE_STATUS") {
        sendResponse({ ok: true, adapter, login: detectLoginState(), fingerprint: pageFingerprint(), errors: errorState(), url: location.href });
        return;
      }
      if (message.type === "FAUST_FILL_MARKETPLACE_FORM") {
        const readiness = detectLoginState();
        if (readiness.state === "logged_out") throw new Error("Marketplace login required before guided publish.");
        const result = fillFields(message.mapping || {}, message.dryRun !== false);
        sendResponse({ ok: true, adapterVersion: adapter?.version, progress: result.blocked.length ? "manual_completion_required" : message.dryRun === false ? "waiting_for_user" : "preview_ready", ...result, fingerprint: pageFingerprint(), fallback: adapter?.fallback, url: location.href });
        return;
      }
      if (message.type === "FAUST_CAPTURE_PUBLISH_CONFIRMATION") {
        sendResponse({ ok: true, adapterVersion: adapter?.version, confirmation: confirmation(), errors: errorState(), artifact: { type: "publish_confirmation", currentUrl: location.href, pageVersion: adapter?.version, metadata: { fingerprint: pageFingerprint(), dom: domSnapshotBoundary() } } });
        return;
      }
      if (message.type === "FAUST_CAPTURE_FAILURE_ARTIFACT") {
        sendResponse({ ok: true, artifact: { type: "dom_snapshot", currentUrl: location.href, pageVersion: adapter?.version, metadata: { fingerprint: pageFingerprint(), errors: errorState(), dom: domSnapshotBoundary(), failedSelector: message.failedSelector } } });
        return;
      }
    } catch (error) {
      sendResponse({ ok: false, error: error.message || "Marketplace content script failed.", artifact: { type: "log", currentUrl: location.href, pageVersion: adapter?.version, metadata: { errors: errorState(), dom: domSnapshotBoundary() } } });
    }
    return true;
  });
})();
