const scanButton = document.getElementById("scan-product");
const importButton = document.getElementById("import-product");
const optionsButton = document.getElementById("open-options");
const status = document.getElementById("status");
const summary = document.getElementById("summary");

function send(message) {
  return chrome.runtime.sendMessage(message);
}

function importDrafts(response) {
  const result = response?.result?.actionResult || response?.result || response?.actionResult || {};
  return result?.drafts || [];
}

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  status.textContent = "Scanning and calculating...";
  const response = await send({ type: "FAUST_SCAN_PRODUCT" });
  scanButton.disabled = false;
  if (!response?.ok) { status.textContent = response?.error || "Scan failed."; return; }
  const top = response.analysis?.actionResult?.byMarketplace?.[0] || response.analysis?.byMarketplace?.[0];
  status.textContent = `Scanned ${response.product.title}`;
  summary.textContent = top ? `Landed: $${top.landedUnitCost.toFixed(2)}\nProfit: $${top.expectedProfit.toFixed(2)}\nROI: ${top.roi.toFixed(1)}%` : JSON.stringify(response.product, null, 2);
});

importButton.addEventListener("click", async () => {
  importButton.disabled = true;
  status.textContent = "Importing approved product...";
  const response = await send({ type: "FAUST_IMPORT_LAST_PRODUCT" });
  importButton.disabled = false;
  if (!response?.ok) { status.textContent = response?.error || "Import failed."; return; }
  const drafts = importDrafts(response).length;
  status.textContent = `Imported into Faust with ${drafts} channel drafts.`;
});

optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
