const scanButton = document.getElementById("scan-product");
const importButton = document.getElementById("import-product");
const optionsButton = document.getElementById("open-options");
const sidePanelButton = document.getElementById("open-sidepanel");
const debugToggle = document.getElementById("debug-toggle");
const status = document.getElementById("status");
const dot = document.getElementById("dot");
const preview = document.getElementById("preview");
const rawOutput = document.getElementById("raw-output");
const debug = document.getElementById("debug");
const history = document.getElementById("history");

let lastProduct = null;
let debugVisible = false;

const money = (value) => Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "Review";

function send(message) {
  return chrome.runtime.sendMessage(message);
}

function writeDetails(value) {
  rawOutput.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function setStatus(text, ok = false) {
  status.textContent = text;
  dot.classList.toggle("ok", ok);
}

function setBusy(busy, text) {
  for (const button of document.querySelectorAll("button")) button.disabled = busy;
  if (text) setStatus(text, false);
}

function renderPreview(product, analysis) {
  if (!product) {
    preview.innerHTML = `<div class="placeholder">No scan</div><div><p class="title">Open a supported listing to begin.</p><p>Faust will detect photos, title, supplier, cost, and readiness.</p></div>`;
    return;
  }
  const best = analysis?.actionResult?.byMarketplace?.[0] || analysis?.byMarketplace?.[0];
  const image = product.images?.[0];
  preview.innerHTML = `
    ${image ? `<img src="${image}" alt="">` : `<div class="placeholder">No photo</div>`}
    <div>
      <p class="title">${product.title || "Untitled product"}</p>
      <p>${product.storeName || product.supplier || "Supplier needs review"}</p>
      <div class="metrics">
        <span class="pill">${money(product.price)} cost</span>
        <span class="pill">${(product.images || []).length} photos</span>
        <span class="pill">${best ? `${money(best.expectedProfit)} profit` : "Profit pending"}</span>
      </div>
    </div>
  `;
}

function renderHistory(items = []) {
  history.innerHTML = items.length ? items.slice(0, 4).map((item) => `
    <div class="history-row"><span>${item.kind === "import" ? "✓" : "•"}</span><b>${item.title || "Untitled product"}</b></div>
  `).join("") : `<p>Recent imports will appear here.</p>`;
}

async function refreshState() {
  try {
    const response = await send({ type: "FAUST_GET_SESSION_STATE" });
    writeDetails(response);
    setStatus(response?.local?.deviceId ? "Faust connected · Ready" : "Connect Faust to import", Boolean(response?.local?.deviceId));
    lastProduct = response?.session?.lastProduct || null;
    renderPreview(lastProduct);
    renderHistory(response?.local?.importHistory || []);
  } catch (error) {
    setStatus("Connection needs attention", false);
    writeDetails({ ok: false, error: error.message });
  }
}

async function scan() {
  setBusy(true, "Detecting listing...");
  try {
    const response = await send({ type: "FAUST_SCAN_PRODUCT" });
    writeDetails(response);
    if (!response?.ok) throw new Error(response?.error || "Scan failed.");
    lastProduct = response.product;
    renderPreview(response.product, response.analysis);
    setStatus("Listing detected · Ready to import", true);
    await refreshState();
  } catch (error) {
    setStatus("Open a supported product listing", false);
    writeDetails({ ok: false, error: error.message });
  } finally {
    setBusy(false);
  }
}

async function quickImport() {
  setBusy(true, "Importing to Faust...");
  try {
    const response = await send({ type: "FAUST_IMPORT_TO_ANALYZER", product: lastProduct });
    writeDetails(response);
    if (!response?.ok) throw new Error(response?.error || "Import failed.");
    renderPreview(response.product || lastProduct, response.analysis);
    setStatus("Imported successfully · Added to Queue", true);
    await refreshState();
  } catch (error) {
    setStatus("Import needs attention", false);
    writeDetails({ ok: false, error: error.message });
  } finally {
    setBusy(false);
  }
}

scanButton.addEventListener("click", scan);
importButton.addEventListener("click", quickImport);
optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
sidePanelButton.addEventListener("click", async () => {
  if (chrome.sidePanel?.open) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.sidePanel.open({ tabId: tab.id });
  }
  window.close();
});
debugToggle.addEventListener("click", () => {
  debugVisible = !debugVisible;
  debug.classList.toggle("hide", !debugVisible);
});
document.addEventListener("error", (event) => {
  if (event.target?.tagName !== "IMG") return;
  event.target.replaceWith(Object.assign(document.createElement("div"), { className: "placeholder", textContent: "No photo" }));
}, true);
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || (event.ctrlKey && event.key === "Enter")) quickImport();
});

refreshState();
