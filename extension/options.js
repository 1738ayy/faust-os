const defaults = { faustBaseUrl: "http://localhost:3000", environment: "local" };
const url = document.getElementById("faustBaseUrl");
const env = document.getElementById("environment");
const status = document.getElementById("status");

chrome.storage.sync.get(defaults).then((settings) => {
  url.value = settings.faustBaseUrl;
  env.value = settings.environment;
});

document.getElementById("save").addEventListener("click", async () => {
  const parsed = new URL(url.value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use http or https.");
  await chrome.storage.sync.set({ faustBaseUrl: parsed.origin, environment: env.value, extensionVersion: "1.0.0" });
  status.textContent = "Saved.";
});
