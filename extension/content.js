chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "import-current-product") return;

  (async () => {
    try {
      const product = window.FaustExtractProduct();
      if (!product.title) throw new Error("Faust could not find a product title on this page.");
      await window.FaustSendProduct(product);
      sendResponse({ success: true, title: product.title });
    } catch (error) {
      sendResponse({ success: false, error: error instanceof Error ? error.message : "Import failed." });
    }
  })();

  return true;
});
