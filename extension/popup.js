const button = document.getElementById("import-product");
const status = document.getElementById("status");

button.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  button.disabled = true;
  status.textContent = "Importing…";
  chrome.tabs.sendMessage(tab.id, { action: "import-current-product" }, (response) => {
    button.disabled = false;
    if (chrome.runtime.lastError) {
      status.textContent = "Open a Superbuy product page first.";
      return;
    }
    status.textContent = response?.success ? `Imported ${response.title}` : response?.error || "Import failed.";
  });
});
