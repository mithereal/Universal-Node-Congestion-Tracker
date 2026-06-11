import { ModemRegistry } from './modems/registry.js';

const MAX_LOG_SIZE = 2000;

chrome.runtime.onInstalled.addListener(() => {
  console.log("Background service synchronized.");
});

chrome.storage.local.get({ extensionEnabled: true }, (data) => {
  updateIcon(data.extensionEnabled);
});

chrome.runtime.onInstalled.addListener(() => {
  ensureBaselineExists();
});

// Run on startup
chrome.runtime.onStartup.addListener(() => {
  ensureBaselineExists();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_CHANGED') {
    updateIcon(message.enabled);
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Handle Granular Channel Data
  if (message.type === "CHANNEL_DATA") {
    saveToStorage("channelStorageLog", message.data);
  }

  // 2. Handle Summary Metrics
  if (message.type === "HARDWARE_METRICS") {
    chrome.storage.local.get({ hardwareMetricsLog: [] }, (result) => {
      let log = result.hardwareMetricsLog;
      const newSample = message.data;

      const lastSample = log[log.length - 1];
      const previousTotal = lastSample ? lastSample.totalUncorrectables : 0;

      // Uncorrectable error delta scaling calculation
      newSample.deltaUncorrectables = (newSample.totalUncorrectables >= previousTotal)
          ? (newSample.totalUncorrectables - previousTotal)
          : newSample.totalUncorrectables;

      log.push(newSample);
      if (log.length > MAX_LOG_SIZE) log.shift();
      chrome.storage.local.set({ hardwareMetricsLog: log });
    });
  }

  // 3. Diagnostic Scan Trigger
  if (message.type === "TRIGGER_DIAGNOSTIC_SCAN") {
    chrome.storage.local.get({ modemProfile: 'auto' }, (settings) => {
      let targetUrls = ["http://192.168.0.1/*", "http://192.168.100.1/*"];
      if (settings.modemProfile !== 'auto') {
        const selectedModem = ModemRegistry.find(m => m.id === settings.modemProfile);
        if (selectedModem && selectedModem.defaultIP) {
          targetUrls = [`http://${selectedModem.defaultIP}/*`];
        }
      }
      chrome.tabs.query({ url: targetUrls }, (tabs) => {
        if (tabs.length === 0) {
          sendResponse({ status: "error", message: "No matched connection targets discovered." });
          return;
        }
        chrome.tabs.reload(tabs[0].id, {}, () => sendResponse({ status: "initiated" }));
      });
    });
    return true; // Keep message channel open for asynchronous sendResponse
  }
});

function saveToStorage(key, newData) {
  chrome.storage.local.get({ [key]: [] }, (result) => {
    const log = result[key];
    log.push(newData);
    if (log.length > MAX_LOG_SIZE) log.shift();
    chrome.storage.local.set({ [key]: log });
  });
}

function updateIcon(isEnabled) {
  const path = isEnabled
    ? { "16": "icon-16.png", "32": "icon-32.png" }
    : { "16": "icon-16-off.png", "32": "icon-32-off.png" };

  chrome.action.setIcon({ path: path });
}
async function ensureBaselineExists() {
  chrome.storage.local.get(['baselineTelemetry', 'hardwareMetricsLog'], (data) => {
    // If it exists, exit
    if (data.baselineTelemetry) return;

    // Default or calculate from existing logs
    const logs = data.hardwareMetricsLog || [];
    let avg = 0;

    if (logs.length > 0) {
      const totalErrors = logs.reduce((sum, log) => sum + (log.totalUncorrectables || 0), 0);
      avg = totalErrors / logs.length;
    }

    const newBaseline = {
      avgUncorrectables: avg,
      setAt: Date.now()
    };

    chrome.storage.local.set({ baselineTelemetry: newBaseline });
  });
}