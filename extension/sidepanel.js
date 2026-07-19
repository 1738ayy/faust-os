const output = document.getElementById("output");
const readiness = document.getElementById("readiness");
const status = document.getElementById("status");

const writeDetails = (value) => {
  output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
};
const setStatus = (value) => {
  status.textContent = value;
};
const importResult = (response) => response?.result?.actionResult || response?.result?.result?.actionResult || response?.result || response?.actionResult || {};
const importDrafts = (response) => importResult(response)?.drafts || [];
const money = (value) => Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "unknown";

function productReview(product, analysis) {
  if (!product) return "No product captured yet.";
  const best = analysis?.actionResult?.byMarketplace?.[0] || analysis?.byMarketplace?.[0];
  const rows = [
    `${product.title || "Untitled product"}`,
    "",
    `Price: ${money(product.price)}${product.priceRange ? ` (${money(product.priceRange.min)}-${money(product.priceRange.max)})` : ""}`,
    `Domestic shipping: ${money(product.domesticShipping)}`,
    `Freight to US: ${money(product.internationalShipping)}${product.internationalShippingEstimateSource ? ` (${product.internationalShippingEstimateSource})` : ""}`,
    `Supplier: ${product.storeName || product.supplier || "Needs review"}`,
    `Category: ${product.category || "Needs review"}`,
    `Stock / MOQ: ${product.stock ?? "unknown"} / ${product.minimumOrderQuantity ?? "unknown"}`,
    `Weight: ${product.weight || product.shippingWeight || "Needs review"}`,
    `Images: ${(product.images || []).length}`,
    `Color variants: ${(product.variantOptions?.colors || []).length || (product.variants || []).length}`,
    `Sizes: ${(product.variantOptions?.sizes || []).length}`,
  ];
  if (best) rows.push("", `Best estimate: ${best.marketplace} - ${money(best.expectedProfit)} profit - ${Number(best.contributionMargin || 0).toFixed(1)}% margin`);
  return rows.join("\n");
}

async function guidedPublish(dryRun) {
  const { lastImport } = await chrome.storage.session.get("lastImport");
  const drafts = importDrafts(lastImport);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = tab?.url ? new URL(tab.url).hostname.toLowerCase() : "";
  const draft = drafts.find((entry) => host.includes(entry.marketplace.toLowerCase())) || drafts[0];
  if (!draft) {
    setStatus("Import a product first, then open a marketplace listing form.");
    writeDetails("No marketplace draft is available yet.");
    return;
  }
  const mapping = {
    title: draft.title,
    description: draft.description,
    category: draft.category,
    price: draft.price,
    quantity: Number(draft.quantity) > 0 ? draft.quantity : undefined,
    sku: draft.physicalSku,
    condition: draft.attributes?.condition || "New with tags",
    shipping: "Standard",
  };
  setStatus(dryRun ? "Previewing fields..." : "Filling supported fields...");
  const response = await chrome.runtime.sendMessage({ type: "FAUST_GUIDED_PUBLISH", mapping, dryRun });
  setStatus(dryRun ? "Preview ready. Open Technical details if you want the full field report." : "Fill attempt complete. Review the marketplace page before publishing.");
  writeDetails(response);
}

document.getElementById("status-button").addEventListener("click", async () => {
  setStatus("Checking connection...");
  const response = await chrome.runtime.sendMessage({ type: "FAUST_STATUS" });
  setStatus(response?.ok ? "Connected to Faust." : "Connection needs attention.");
  writeDetails(response);
});

document.getElementById("register-button").addEventListener("click", async () => {
  setStatus("Connecting this browser...");
  const response = await chrome.runtime.sendMessage({ type: "FAUST_REGISTER_DEVICE" });
  setStatus(response?.ok ? "Browser connected. You can scan products now." : "Could not connect browser.");
  writeDetails(response);
});

document.getElementById("scan-button").addEventListener("click", async () => {
  setStatus("Scanning product...");
  const response = await chrome.runtime.sendMessage({ type: "FAUST_SCAN_PRODUCT" });
  readiness.textContent = response?.ok ? productReview(response.product, response.analysis) : "Scan failed. Open Technical details to inspect the error.";
  setStatus(response?.ok ? "Preview ready. Use Import to Faust when you want to continue." : "Scan failed.");
  writeDetails(response);
});

document.getElementById("import-button").addEventListener("click", async () => {
  setStatus("Importing to Faust...");
  const response = await chrome.runtime.sendMessage({ type: "FAUST_IMPORT_TO_ANALYZER" });
  readiness.textContent = response?.ok ? productReview(response.product, response.analysis) : "Import failed. Open Technical details to inspect the error.";
  setStatus(response?.ok ? "Imported. Continue in Faust to review and create the product." : "Import failed.");
  writeDetails(response);
});

document.getElementById("dry-run-button").addEventListener("click", async () => {
  await guidedPublish(true);
});

document.getElementById("fill-button").addEventListener("click", async () => {
  await guidedPublish(false);
});
