const defaults = { faustBaseUrl: "https://faust-os-staging.vercel.app", environment: "staging", deviceName: "Faust Chrome Extension", extensionVersion: "2.0.1-runtime" };
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
  await chrome.storage.sync.set({ faustBaseUrl: parsed.origin, environment: env.value, deviceName: deviceName.value || defaults.deviceName, extensionVersion: defaults.extensionVersion });
  status.textContent = "Saved.";
});
