chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!["import-current-product", "scan-current-product"].includes(message.action)) return;

  (async () => {
    try {
      const product = window.FaustExtractProduct();
      if (!product.title) throw new Error("Faust could not find a product title on this page.");
      if (message.action === "scan-current-product") {
        sendResponse(product);
        return;
      }
      await window.FaustSendProduct(product);
      sendResponse({ success: true, title: product.title });
    } catch (error) {
      sendResponse({ success: false, error: error instanceof Error ? error.message : "Import failed." });
    }
  })();

  return true;
});
