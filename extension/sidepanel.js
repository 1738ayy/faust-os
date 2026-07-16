const output = document.getElementById("output");
const readiness = document.getElementById("readiness");
const write = (value) => { output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); };

document.getElementById("status-button").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "FAUST_STATUS" });
  write(response);
});

document.getElementById("scan-button").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "FAUST_SCAN_PRODUCT" });
  write(response);
});

document.getElementById("import-button").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "FAUST_IMPORT_LAST_PRODUCT" });
  const drafts = response?.result?.actionResult?.drafts || [];
  readiness.textContent = drafts.length ? drafts.map((draft) => `${draft.marketplace}: ${draft.status} / ${draft.publishMode}`).join("\n") : "No drafts returned.";
  write(response);
});
