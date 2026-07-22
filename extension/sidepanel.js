const elements = {
  output: document.getElementById("output"),
  timeline: document.getElementById("timeline"),
  productPreview: document.getElementById("product-preview"),
  emptyState: document.getElementById("empty-state"),
  summary: document.getElementById("summary"),
  photos: document.getElementById("photos"),
  photoSection: document.getElementById("photo-section"),
  imageCount: document.getElementById("image-count"),
  success: document.getElementById("success"),
  connectionLabel: document.getElementById("connection-label"),
  connectionDot: document.getElementById("connection-dot"),
  debugPanel: document.getElementById("debug-panel"),
};

const steps = ["Detect listing", "Extract photos", "Read product details", "Estimate profit", "Ready to import"];
let state = { product: null, analysis: null, selectedImages: [], coverIndex: 0, busy: false, debug: false, compact: false };

const money = (value) => Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "Needs review";
const first = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
const byMarketplace = () => state.analysis?.actionResult?.byMarketplace || state.analysis?.byMarketplace || [];
const bestMarket = () => byMarketplace()[0];
const readinessScore = () => {
  const product = state.product;
  if (!product) return 0;
  const checks = [
    Boolean(product.title),
    Boolean((product.images || []).length),
    Number(product.price) > 0,
    Boolean(product.storeName || product.supplier),
    Boolean(product.category),
    Boolean(product.weight || product.shippingWeight),
    Boolean((product.variants || []).length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

function send(message) {
  return chrome.runtime.sendMessage(message);
}

function setBusy(busy, label = "Working...") {
  state.busy = busy;
  for (const button of document.querySelectorAll("button")) button.disabled = busy;
  if (busy) elements.connectionLabel.textContent = label;
}

function writeDetails(value) {
  elements.output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function setConnection(ok, label) {
  elements.connectionDot.classList.toggle("ok", Boolean(ok));
  elements.connectionLabel.textContent = label;
}

function renderTimeline(activeIndex = state.product ? 4 : 0) {
  elements.timeline.innerHTML = steps.map((label, index) => {
    const className = index < activeIndex ? "step done" : index === activeIndex ? "step active" : "step";
    return `<div class="${className}">${index < activeIndex ? "✓" : "•"} ${label}</div>`;
  }).join("");
}

function productWithSelectedImages() {
  if (!state.product) return null;
  const images = state.selectedImages.length ? state.selectedImages : state.product.images || [];
  return { ...state.product, images };
}

function renderPreview() {
  const product = state.product;
  elements.emptyState.hidden = Boolean(product);
  elements.productPreview.hidden = !product;
  if (!product) {
    elements.productPreview.innerHTML = "";
    return;
  }
  const images = state.selectedImages.length ? state.selectedImages : product.images || [];
  const cover = images[state.coverIndex] || images[0];
  const best = bestMarket();
  elements.productPreview.innerHTML = `
    <div class="cover">${cover ? `<img src="${cover}" alt="">` : "No photo yet"}</div>
    <div>
      <div class="pill">${product.source || "Source"} · ${readinessScore()}% ready</div>
      <p class="title">${product.title || "Untitled product"}</p>
      <p class="sub">${first(product.storeName, product.supplier, "Supplier needs review")}</p>
      <div class="facts">
        <div class="fact"><span>Cost</span><b>${money(product.price)}</b></div>
        <div class="fact"><span>Best profit</span><b>${best ? money(best.expectedProfit) : "Analyzing"}</b></div>
        <div class="fact"><span>Category</span><b>${product.category || "Review"}</b></div>
        <div class="fact"><span>Marketplace</span><b>${best?.marketplace || "Depop"}</b></div>
      </div>
    </div>
  `;
}

function renderSummary() {
  const product = state.product;
  const images = state.selectedImages.length || product?.images?.length || 0;
  const best = bestMarket();
  const items = product ? [
    ["Photos", `${images} selected`],
    ["Title", product.title ? "Ready" : "Needs review"],
    ["Price", Number(product.price) > 0 ? money(product.price) : "Needs review"],
    ["Supplier", product.storeName || product.supplier ? "Ready" : "Needs review"],
    ["Estimated profit", best ? money(best.expectedProfit) : "Calculating"],
    ["Queue", "Ready"],
  ] : [
    ["Listing", "Waiting"],
    ["Photos", "Waiting"],
    ["Details", "Waiting"],
    ["Pricing", "Waiting"],
    ["Queue", "Waiting"],
    ["Faust", "Ready"],
  ];
  elements.summary.innerHTML = items.map(([label, value]) => `<div class="check"><b>${value}</b>${label}</div>`).join("");
}

function renderPhotos() {
  const product = state.product;
  const images = product?.images || [];
  elements.photoSection.hidden = !images.length;
  if (!images.length) {
    elements.photos.innerHTML = "";
    elements.imageCount.textContent = "0 selected";
    return;
  }
  const selected = new Set(state.selectedImages);
  elements.imageCount.textContent = `${selected.size} selected`;
  elements.photos.innerHTML = images.map((src, index) => `
    <button class="thumb ${selected.has(src) ? "selected" : ""}" data-index="${index}" type="button" aria-label="${selected.has(src) ? "Deselect" : "Select"} photo ${index + 1}">
      <img src="${src}" alt="">
      ${index === state.coverIndex ? `<span class="badge">Cover</span>` : ""}
    </button>
  `).join("");
  for (const button of elements.photos.querySelectorAll(".thumb")) {
    button.addEventListener("click", () => togglePhoto(Number(button.dataset.index)));
  }
}

function renderHistory(items = []) {
  const history = items.length ? items : [];
  document.getElementById("history").innerHTML = history.length ? history.map((item) => `
    <div class="history-item">
      ${item.image ? `<img src="${item.image}" alt="">` : `<span class="cover" style="width:34px;height:34px;min-height:34px;border-radius:10px"></span>`}
      <div><b>${item.title || "Untitled product"}</b><span>${item.kind === "import" ? "Imported" : "Scanned"} today</span></div>
    </div>
  `).join("") : `<p class="sub">Recent scans and imports will appear here.</p>`;
}

function renderAll() {
  renderTimeline();
  renderPreview();
  renderPhotos();
  renderSummary();
  document.body.classList.toggle("compact", state.compact);
  document.getElementById("compact-mode").classList.toggle("active", state.compact);
  document.getElementById("expanded-mode").classList.toggle("active", !state.compact);
  elements.debugPanel.classList.toggle("debug-hidden", !state.debug);
}

function togglePhoto(index) {
  const src = state.product?.images?.[index];
  if (!src) return;
  const selected = new Set(state.selectedImages);
  if (selected.has(src)) selected.delete(src);
  else selected.add(src);
  state.selectedImages = [...selected];
  if (!state.selectedImages[state.coverIndex]) state.coverIndex = 0;
  renderAll();
}

async function checkConnection(silent = false) {
  if (!silent) setBusy(true, "Checking Faust connection...");
  try {
    const response = await send({ type: "FAUST_STATUS" });
    writeDetails(response);
    const configured = response?.ok && response?.response?.ok !== false;
    setConnection(configured, configured ? "Faust connected · Queue ready" : "Connection needs attention");
    renderHistory(response?.local?.importHistory || []);
  } catch (error) {
    setConnection(false, "Connect Faust before importing");
    writeDetails({ ok: false, error: error.message });
  } finally {
    if (!silent) setBusy(false);
  }
}

async function scanProduct(silent = false) {
  if (!silent) setBusy(true, "Scanning source product...");
  renderTimeline(1);
  try {
    const response = await send({ type: "FAUST_SCAN_PRODUCT" });
    writeDetails(response);
    if (!response?.ok) throw new Error(response?.error || "Faust could not read this product.");
    state.product = response.product;
    state.analysis = response.analysis;
    state.selectedImages = [...(response.product.images || [])];
    state.coverIndex = 0;
    renderTimeline(5);
    renderAll();
    setConnection(true, "Listing detected · Ready to import");
  } catch (error) {
    renderTimeline(0);
    setConnection(false, "Open a supported product listing to scan");
    writeDetails({ ok: false, error: error.message });
  } finally {
    if (!silent) setBusy(false);
  }
}

async function quickImport() {
  if (!state.product) await scanProduct(true);
  const product = productWithSelectedImages();
  if (!product) return;
  setBusy(true, "Importing to Faust...");
  try {
    const response = await send({ type: "FAUST_IMPORT_TO_ANALYZER", product });
    writeDetails(response);
    if (!response?.ok) throw new Error(response?.error || "Import failed.");
    state.product = response.product || product;
    state.analysis = response.analysis || state.analysis;
    elements.success.classList.add("show");
    setConnection(true, "Imported successfully · Product added to Queue");
    await checkConnection(true);
    setTimeout(() => elements.success.classList.remove("show"), 6500);
  } catch (error) {
    setConnection(false, "Import needs attention · Retry or open Debug");
    writeDetails({ ok: false, error: error.message });
  } finally {
    setBusy(false);
  }
}

async function guidedPublish(dryRun) {
  setBusy(true, dryRun ? "Previewing listing fields..." : "Filling safe listing fields...");
  try {
    const { lastImport } = await chrome.storage.session.get("lastImport");
    const actionResult = lastImport?.result?.actionResult || lastImport?.actionResult || {};
    const drafts = actionResult.drafts || [];
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const host = tab?.url ? new URL(tab.url).hostname.toLowerCase() : "";
    const draft = drafts.find((entry) => host.includes(entry.marketplace.toLowerCase())) || drafts[0];
    if (!draft) throw new Error("Import a product first, then open a marketplace listing form.");
    const mapping = { title: draft.title, description: draft.description, category: draft.category, price: draft.price, quantity: Number(draft.quantity) > 0 ? draft.quantity : undefined, sku: draft.physicalSku, condition: draft.attributes?.condition || "New with tags", shipping: "Standard" };
    const response = await send({ type: "FAUST_GUIDED_PUBLISH", mapping, dryRun });
    writeDetails(response);
    setConnection(true, dryRun ? "Preview ready · Review highlighted fields" : "Fields filled · Review before publishing");
  } catch (error) {
    setConnection(false, "Marketplace fill needs attention");
    writeDetails({ ok: false, error: error.message });
  } finally {
    setBusy(false);
  }
}

document.getElementById("quick-import").addEventListener("click", quickImport);
document.getElementById("scan-button").addEventListener("click", () => scanProduct(false));
document.getElementById("open-faust").addEventListener("click", async () => {
  const config = await chrome.storage.sync.get({ faustBaseUrl: "http://localhost:3000" });
  chrome.tabs.create({ url: `${config.faustBaseUrl}/opportunity-analyzer` });
});
document.getElementById("dry-run-button").addEventListener("click", () => guidedPublish(true));
document.getElementById("fill-button").addEventListener("click", () => guidedPublish(false));
document.getElementById("status-button").addEventListener("click", () => checkConnection(false));
document.getElementById("register-button").addEventListener("click", async () => {
  setBusy(true, "Connecting this browser...");
  try {
    const response = await send({ type: "FAUST_REGISTER_DEVICE" });
    writeDetails(response);
    setConnection(Boolean(response?.ok), response?.ok ? "Browser connected · Ready to scan" : "Connection needs attention");
  } catch (error) {
    setConnection(false, "Connection failed · Open Debug for details");
    writeDetails({ ok: false, error: error.message });
  } finally {
    setBusy(false);
  }
});
document.getElementById("select-all").addEventListener("click", () => { state.selectedImages = [...(state.product?.images || [])]; renderAll(); });
document.getElementById("clear-all").addEventListener("click", () => { state.selectedImages = []; renderAll(); });
document.getElementById("debug-toggle").addEventListener("click", () => { state.debug = !state.debug; renderAll(); });
document.getElementById("compact-mode").addEventListener("click", async () => { state.compact = true; await chrome.storage.sync.set({ extensionViewMode: "compact" }); renderAll(); });
document.getElementById("expanded-mode").addEventListener("click", async () => { state.compact = false; await chrome.storage.sync.set({ extensionViewMode: "expanded" }); renderAll(); });
document.getElementById("import-another").addEventListener("click", () => { elements.success.classList.remove("show"); scanProduct(false); });
document.addEventListener("error", (event) => {
  if (event.target?.tagName !== "IMG") return;
  const image = event.target;
  image.replaceWith(Object.assign(document.createElement("div"), { className: image.closest(".thumb") ? "placeholder" : "cover", textContent: "Image unavailable" }));
}, true);
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.ctrlKey) quickImport();
  else if (event.key === "Enter") quickImport();
  else if (event.ctrlKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    state.selectedImages = [...(state.product?.images || [])];
    renderAll();
  }
});

(async function boot() {
  const stored = await chrome.storage.sync.get({ extensionViewMode: "expanded" });
  state.compact = stored.extensionViewMode === "compact";
  renderAll();
  await checkConnection(true);
  await scanProduct(true);
})();
