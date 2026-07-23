(() => {
  window.FaustSend = async function send(path, body) {
    const settings = await chrome.storage.sync.get({ faustBaseUrl: "https://faust-os-staging.vercel.app", extensionVersion: "2.0.1-runtime" });
    const baseUrl = new URL(settings.faustBaseUrl).origin;
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Faust-Extension-Version": settings.extensionVersion },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Faust extension request failed.");
    return result;
  };

  window.FaustSendProduct = async function sendProduct(product) {
    return window.FaustSend("/api/extension/import", { product, approved: true, idempotencyKey: crypto.randomUUID() });
  };
})();
