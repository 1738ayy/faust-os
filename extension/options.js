const defaults = { faustBaseUrl: "http://localhost:3000", environment: "local", deviceName: "Faust Chrome Extension" };
const url = document.getElementById("faustBaseUrl");
const env = document.getElementById("environment");
const deviceName = document.getElementById("deviceName");
const status = document.getElementById("status");

chrome.storage.sync.get(defaults).then((settings) => {
  url.value = settings.faustBaseUrl;
  env.value = settings.environment;
  deviceName.value = settings.deviceName;
});

document.getElementById("save").addEventListener("click", async () => {
  const parsed = new URL(url.value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use http or https.");
  await chrome.storage.sync.set({ faustBaseUrl: parsed.origin, environment: env.value, deviceName: deviceName.value || defaults.deviceName, extensionVersion: "1.1.0-phase2" });
  status.textContent = "Saved.";
});
