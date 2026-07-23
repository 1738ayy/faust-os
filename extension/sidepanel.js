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
  imageModal: document.getElementById("image-modal"),
  modalTitle: document.getElementById("modal-title"),
  modalImage: document.getElementById("modal-image"),
  previewStage: document.getElementById("preview-stage"),
  cropBox: document.getElementById("crop-box"),
};

const steps = ["Detect listing", "Extract photos", "Read product details", "Estimate profit", "Ready to import"];
let state = { product: null, analysis: null, selectedImages: [], coverIndex: 0, busy: false, debug: false, compact: false, modalIndex: 0, cropMode: false, crop: { x: 15, y: 12, width: 70, height: 76 }, cropDrag: null, dragIndex: null };
let currentImportRequestId = null;

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWakeableRuntimeError(error) {
  return /Receiving end does not exist|Extension context invalidated|message channel closed/i.test(error?.message || "");
}

async function send(message, attempts = 2) {
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      if (message.type !== "PING") await chrome.runtime.sendMessage({ type: "PING" }).catch(() => undefined);
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (attempt >= attempts || !isWakeableRuntimeError(error)) throw error;
      await wait(150 * (attempt + 1));
    }
  }
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
  const selected = state.selectedImages.length ? state.selectedImages : state.product.images || [];
  const cover = (state.product.images || [])[state.coverIndex] || selected[0];
  const images = cover ? [cover, ...selected.filter((image) => image !== cover)] : selected;
  return { ...state.product, images };
}

async function persistDraftState() {
  await chrome.storage.session.set({
    faustSidePanelDraft: {
      product: state.product,
      analysis: state.analysis,
      selectedImages: state.selectedImages,
      coverIndex: state.coverIndex,
    },
  });
}

function setProductImages(nextImages) {
  if (!state.product) return;
  const currentCover = state.product.images?.[state.coverIndex];
  state.product = { ...state.product, images: [...new Set(nextImages.filter(Boolean))] };
  state.selectedImages = state.selectedImages.filter((image) => state.product.images.includes(image));
  if (!state.selectedImages.length) state.selectedImages = [...state.product.images];
  const coverIndex = currentCover ? state.product.images.indexOf(currentCover) : state.coverIndex;
  state.coverIndex = coverIndex >= 0 ? coverIndex : 0;
  persistDraftState();
}

function move(items, from, to) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
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
    <div class="thumb ${selected.has(src) ? "selected" : ""}" data-index="${index}" draggable="true" role="option" aria-selected="${selected.has(src)}" tabindex="0" aria-label="Photo ${index + 1}">
      <img src="${src}" alt="">
      ${index === state.coverIndex ? `<span class="badge">Cover</span>` : ""}
      <button class="corner" data-action="remove" type="button" aria-label="Remove photo ${index + 1}">×</button>
      <div class="tools">
        <button data-action="select" type="button">${selected.has(src) ? "Selected" : "Select"}</button>
        <button data-action="cover" type="button">Cover</button>
        <button data-action="crop" type="button">Crop</button>
      </div>
    </div>
  `).join("");
  for (const tile of elements.photos.querySelectorAll(".thumb")) {
    const index = Number(tile.dataset.index);
    tile.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openImageModal(index);
    });
    tile.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openImageModal(index);
      if (event.key === "Delete" || event.key === "Backspace") removePhoto(index);
    });
    tile.addEventListener("dragstart", () => { state.dragIndex = index; tile.classList.add("dragging"); });
    tile.addEventListener("dragend", () => { state.dragIndex = null; tile.classList.remove("dragging"); tile.classList.remove("drop-target"); });
    tile.addEventListener("dragover", (event) => { event.preventDefault(); tile.classList.add("drop-target"); });
    tile.addEventListener("dragleave", () => tile.classList.remove("drop-target"));
    tile.addEventListener("drop", (event) => {
      event.preventDefault();
      tile.classList.remove("drop-target");
      reorderPhoto(state.dragIndex, index);
    });
    tile.querySelector('[data-action="select"]')?.addEventListener("click", () => togglePhoto(index));
    tile.querySelector('[data-action="cover"]')?.addEventListener("click", () => setCover(index));
    tile.querySelector('[data-action="crop"]')?.addEventListener("click", () => openImageModal(index, true));
    tile.querySelector('[data-action="remove"]')?.addEventListener("click", () => removePhoto(index));
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
  persistDraftState();
  renderAll();
}

function setCover(index) {
  if (!state.product?.images?.[index]) return;
  state.coverIndex = index;
  if (!state.selectedImages.includes(state.product.images[index])) state.selectedImages = [state.product.images[index], ...state.selectedImages];
  persistDraftState();
  renderAll();
}

function removePhoto(index) {
  const src = state.product?.images?.[index];
  if (!src) return;
  setProductImages(state.product.images.filter((_, imageIndex) => imageIndex !== index));
  if (state.modalIndex >= state.product.images.length) state.modalIndex = Math.max(0, state.product.images.length - 1);
  closeImageModal();
  renderAll();
}

function reorderPhoto(from, to) {
  if (!state.product || from === null || from === undefined || from < 0 || to < 0 || from === to) return;
  const cover = state.product.images[state.coverIndex];
  setProductImages(move(state.product.images, from, to));
  state.coverIndex = Math.max(0, state.product.images.indexOf(cover));
  renderAll();
}

async function imagePreviewUrl(src) {
  const config = await chrome.storage.sync.get({ faustBaseUrl: "https://faust-os-staging.vercel.app" });
  const base = config.faustBaseUrl.replace(/\/$/, "");
  const url = src.startsWith("/api/") ? `${base}${src}` : /^https?:\/\//i.test(src) ? `${base}/api/import-image?url=${encodeURIComponent(src)}` : src;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Image preview could not be opened.");
  return URL.createObjectURL(await response.blob());
}

async function openImageModal(index, crop = false) {
  if (!state.product?.images?.[index]) return;
  state.modalIndex = index;
  state.cropMode = crop;
  state.crop = { x: 15, y: 12, width: 70, height: 76 };
  elements.modalImage.src = "";
  elements.modalTitle.textContent = crop ? "Crop image" : "Image preview";
  elements.imageModal.hidden = false;
  renderCropBox();
  try {
    elements.modalImage.src = await imagePreviewUrl(state.product.images[index]);
  } catch (error) {
    setConnection(false, "Image preview needs attention");
    writeDetails({ ok: false, error: error.message });
  }
}

function closeImageModal() {
  elements.imageModal.hidden = true;
  state.cropMode = false;
  state.cropDrag = null;
  elements.cropBox.hidden = true;
}

function navigateModal(delta) {
  const images = state.product?.images || [];
  if (!images.length) return closeImageModal();
  state.modalIndex = (state.modalIndex + delta + images.length) % images.length;
  void openImageModal(state.modalIndex, state.cropMode);
  renderCropBox();
}

function renderCropBox() {
  elements.cropBox.hidden = !state.cropMode;
  if (!state.cropMode) return;
  Object.assign(elements.cropBox.style, {
    left: `${state.crop.x}%`,
    top: `${state.crop.y}%`,
    width: `${state.crop.width}%`,
    height: `${state.crop.height}%`,
  });
}

function clampCrop(crop) {
  const width = Math.max(20, Math.min(100, crop.width));
  const height = Math.max(20, Math.min(100, crop.height));
  return {
    x: Math.max(0, Math.min(100 - width, crop.x)),
    y: Math.max(0, Math.min(100 - height, crop.y)),
    width,
    height,
  };
}

function startCropDrag(event) {
  if (!state.cropMode) return;
  event.preventDefault();
  const handle = event.target.className || "move";
  state.cropDrag = { pointerId: event.pointerId, mode: typeof handle === "string" && handle ? handle : "move", startX: event.clientX, startY: event.clientY, start: { ...state.crop } };
  elements.cropBox.setPointerCapture(event.pointerId);
}

function moveCrop(event) {
  if (!state.cropDrag) return;
  const rect = elements.previewStage.getBoundingClientRect();
  const dx = ((event.clientX - state.cropDrag.startX) / rect.width) * 100;
  const dy = ((event.clientY - state.cropDrag.startY) / rect.height) * 100;
  const next = { ...state.cropDrag.start };
  const mode = state.cropDrag.mode;
  if (mode === "move" || mode === "crop-box") {
    next.x += dx;
    next.y += dy;
  } else {
    if (mode.includes("e")) next.width += dx;
    if (mode.includes("s")) next.height += dy;
    if (mode.includes("w")) {
      next.x += dx;
      next.width -= dx;
    }
    if (mode.includes("n")) {
      next.y += dy;
      next.height -= dy;
    }
  }
  state.crop = clampCrop(next);
  renderCropBox();
}

function endCropDrag() {
  state.cropDrag = null;
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Crop could not be prepared.")), "image/jpeg", 0.92);
  });
}

async function uploadCroppedImage(blob) {
  const config = await chrome.storage.sync.get({ faustBaseUrl: "https://faust-os-staging.vercel.app" });
  const form = new FormData();
  form.set("file", blob, "faust-extension-crop.jpg");
  const response = await fetch(`${config.faustBaseUrl.replace(/\/$/, "")}/api/import-image`, { method: "POST", body: form });
  const payload = await response.json();
  if (!response.ok || !payload.ok || !payload.url) throw new Error(payload.message || "Cropped image could not be saved.");
  return payload.url;
}

async function saveCrop() {
  if (!state.product?.images?.[state.modalIndex]) return;
  setBusy(true, "Saving crop...");
  try {
    const image = elements.modalImage;
    const canvas = document.createElement("canvas");
    const sourceWidth = image.naturalWidth || 1;
    const sourceHeight = image.naturalHeight || 1;
    const sx = Math.round((state.crop.x / 100) * sourceWidth);
    const sy = Math.round((state.crop.y / 100) * sourceHeight);
    const sw = Math.round((state.crop.width / 100) * sourceWidth);
    const sh = Math.round((state.crop.height / 100) * sourceHeight);
    canvas.width = Math.max(1, sw);
    canvas.height = Math.max(1, sh);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Crop editor is unavailable.");
    context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const uploaded = await uploadCroppedImage(await canvasBlob(canvas));
    const next = [...state.product.images];
    const old = next[state.modalIndex];
    next[state.modalIndex] = uploaded;
    state.selectedImages = state.selectedImages.map((entry) => entry === old ? uploaded : entry);
    setProductImages(next);
    elements.modalImage.src = uploaded;
    state.cropMode = false;
    renderCropBox();
    renderAll();
    setConnection(true, "Crop saved · Review images before import");
  } catch (error) {
    setConnection(false, "Crop needs attention");
    writeDetails({ ok: false, error: error.message });
  } finally {
    setBusy(false);
  }
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
    await persistDraftState();
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
  currentImportRequestId ||= crypto.randomUUID();
  setBusy(true, "Connecting to Faust...");
  try {
    const response = await send({ type: "FAUST_IMPORT_TO_ANALYZER", product, requestId: currentImportRequestId });
    writeDetails(response);
    if (!response?.ok) throw new Error(response?.error || "Import failed.");
    state.product = response.product || product;
    state.analysis = response.analysis || state.analysis;
    await persistDraftState();
    elements.success.classList.add("show");
    setConnection(true, "Imported successfully · Product added to Queue");
    currentImportRequestId = null;
    await checkConnection(true);
    setTimeout(() => elements.success.classList.remove("show"), 6500);
  } catch (error) {
    setConnection(false, isWakeableRuntimeError(error) ? "Import interrupted · Retry or open Debug" : "Import needs attention · Retry or open Debug");
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
  const config = await chrome.storage.sync.get({ faustBaseUrl: "https://faust-os-staging.vercel.app" });
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
document.getElementById("select-all").addEventListener("click", () => { state.selectedImages = [...(state.product?.images || [])]; persistDraftState(); renderAll(); });
document.getElementById("clear-all").addEventListener("click", () => { state.selectedImages = []; persistDraftState(); renderAll(); });
document.getElementById("debug-toggle").addEventListener("click", () => { state.debug = !state.debug; renderAll(); });
document.getElementById("compact-mode").addEventListener("click", async () => { state.compact = true; await chrome.storage.sync.set({ extensionViewMode: "compact" }); renderAll(); });
document.getElementById("expanded-mode").addEventListener("click", async () => { state.compact = false; await chrome.storage.sync.set({ extensionViewMode: "expanded" }); renderAll(); });
document.getElementById("import-another").addEventListener("click", () => { elements.success.classList.remove("show"); scanProduct(false); });
document.getElementById("modal-close").addEventListener("click", closeImageModal);
document.getElementById("modal-prev").addEventListener("click", () => navigateModal(-1));
document.getElementById("modal-next").addEventListener("click", () => navigateModal(1));
document.getElementById("modal-cover").addEventListener("click", () => { setCover(state.modalIndex); });
document.getElementById("modal-crop").addEventListener("click", () => { state.cropMode = !state.cropMode; elements.modalTitle.textContent = state.cropMode ? "Crop image" : "Image preview"; renderCropBox(); });
document.getElementById("modal-reset").addEventListener("click", () => { state.crop = { x: 15, y: 12, width: 70, height: 76 }; renderCropBox(); });
document.getElementById("modal-save").addEventListener("click", saveCrop);
elements.cropBox.addEventListener("pointerdown", startCropDrag);
elements.cropBox.addEventListener("pointermove", moveCrop);
elements.cropBox.addEventListener("pointerup", endCropDrag);
elements.cropBox.addEventListener("pointercancel", endCropDrag);
document.addEventListener("error", (event) => {
  if (event.target?.tagName !== "IMG") return;
  const image = event.target;
  image.replaceWith(Object.assign(document.createElement("div"), { className: image.closest(".thumb") ? "placeholder" : "cover", textContent: "Image unavailable" }));
}, true);
document.addEventListener("keydown", (event) => {
  if (!elements.imageModal.hidden) {
    if (event.key === "Escape") closeImageModal();
    if (event.key === "ArrowLeft") navigateModal(-1);
    if (event.key === "ArrowRight") navigateModal(1);
    if (event.key === "Enter" && state.cropMode) saveCrop();
    if (event.key === "Delete" || event.key === "Backspace") removePhoto(state.modalIndex);
    return;
  }
  if (event.key === "Enter" && event.ctrlKey) quickImport();
  else if (event.key === "Enter") quickImport();
  else if (event.ctrlKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    state.selectedImages = [...(state.product?.images || [])];
    renderAll();
  }
});

(async function boot() {
  await send({ type: "PING" }).catch(() => undefined);
  const stored = await chrome.storage.sync.get({ extensionViewMode: "expanded" });
  state.compact = stored.extensionViewMode === "compact";
  const draft = await chrome.storage.session.get("faustSidePanelDraft");
  if (draft.faustSidePanelDraft?.product) {
    state.product = draft.faustSidePanelDraft.product;
    state.analysis = draft.faustSidePanelDraft.analysis;
    state.selectedImages = draft.faustSidePanelDraft.selectedImages || [...(state.product.images || [])];
    state.coverIndex = draft.faustSidePanelDraft.coverIndex || 0;
  }
  renderAll();
  await checkConnection(true);
  if (!state.product) await scanProduct(true);
})();
