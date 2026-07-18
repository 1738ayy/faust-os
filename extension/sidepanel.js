const output = document.getElementById("output");
const readiness = document.getElementById("readiness");
const write = (value) => { output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); };
const importResult = (response) => response?.result?.actionResult || response?.result?.result?.actionResult || response?.result || response?.actionResult || {};
const importDrafts = (response) => importResult(response)?.drafts || [];

async function guidedPublish(dryRun) {
  const { lastImport } = await chrome.storage.session.get("lastImport");
  const drafts = importDrafts(lastImport);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = tab?.url ? new URL(tab.url).hostname.toLowerCase() : "";
  const draft = drafts.find((entry) => host.includes(entry.marketplace.toLowerCase())) || drafts[0];
  if (!draft) { write("Import a product first, then open a marketplace listing form."); return; }
  const mapping = { title: draft.title, description: draft.description, category: draft.category, price: draft.price, quantity: draft.quantity, sku: draft.physicalSku, condition: draft.attributes?.condition || "New with tags", shipping: "Standard" };
  write(await chrome.runtime.sendMessage({ type: "FAUST_GUIDED_PUBLISH", mapping, dryRun }));
}

document.getElementById("status-button").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "FAUST_STATUS" });
  write(response);
});

document.getElementById("register-button").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "FAUST_REGISTER_DEVICE" });
  write(response);
});

document.getElementById("scan-button").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "FAUST_SCAN_PRODUCT" });
  write(response);
});

document.getElementById("import-button").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "FAUST_IMPORT_LAST_PRODUCT" });
  const drafts = importDrafts(response);
  readiness.textContent = drafts.length ? drafts.map((draft) => `${draft.marketplace}: ${draft.status} / ${draft.publishMode}`).join("\n") : "No drafts returned.";
  write(response);
});

document.getElementById("dry-run-button").addEventListener("click", async () => {
  await guidedPublish(true);
});

document.getElementById("fill-button").addEventListener("click", async () => {
  await guidedPublish(false);
});
