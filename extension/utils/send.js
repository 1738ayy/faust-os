(() => {
  window.FaustSend = async function send(path, body) {
    const response = await fetch(`http://localhost:3000${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Faust-Extension-Version": "1.0.0" },
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
