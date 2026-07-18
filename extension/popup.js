const scanButton = document.getElementById("scan-product");
const importButton = document.getElementById("import-product");
const optionsButton = document.getElementById("open-options");
const status = document.getElementById("status");
const summary = document.getElementById("summary");
const rawOutput = document.getElementById("raw-output");

function send(message) {
  return chrome.runtime.sendMessage(message);
}

function writeDetails(value) {
  rawOutput.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function importDrafts(response) {
  const result = response?.result?.actionResult || response?.result || response?.actionResult || {};
  return result?.drafts || [];
}

function compactScanSummary(response) {
  const product = response.product;
  const top = response.analysis?.actionResult?.byMarketplace?.[0] || response.analysis?.byMarketplace?.[0];
  const rows = [
    product.title,
    "",
    `Supplier: ${product.storeName || product.supplier || "Needs review"}`,
    `Price: $${Number(product.price || 0).toFixed(2)}`,
    `Images: ${(product.images || []).length}`,
    `Variants: ${(product.variants || []).length}`,
  ];
  if (top) rows.push(`Best estimate: ${top.marketplace} · $${top.expectedProfit.toFixed(2)} profit`);
  return rows.join("\n");
}

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  status.textContent = "Scanning product...";
  const response = await send({ type: "FAUST_SCAN_PRODUCT" });
  scanButton.disabled = false;
  writeDetails(response);
  if (!response?.ok) {
    status.textContent = response?.error || "Scan failed.";
    summary.textContent = "Open Technical details to inspect the error.";
    return;
  }
  status.textContent = "Product scanned.";
  summary.textContent = compactScanSummary(response);
});

importButton.addEventListener("click", async () => {
  importButton.disabled = true;
  status.textContent = "Creating drafts...";
  const response = await send({ type: "FAUST_IMPORT_LAST_PRODUCT" });
  importButton.disabled = false;
  writeDetails(response);
  if (!response?.ok) {
    status.textContent = response?.error || "Import failed.";
    summary.textContent = "Open Technical details to inspect the error.";
    return;
  }
  const drafts = importDrafts(response).length;
  status.textContent = "Imported to Faust.";
  summary.textContent = `${drafts} marketplace draft${drafts === 1 ? "" : "s"} created.`;
});

optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
