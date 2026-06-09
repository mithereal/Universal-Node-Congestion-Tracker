// background.js
import { ModemRegistry } from './modems/registry.js';

const MAX_LOG_SIZE = 2000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ hardwareMetricsLog: [] }, (data) => {
    console.log("Background service fully synchronized. Log Cache size:", data.hardwareMetricsLog.length);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "HARDWARE_METRICS") {
      chrome.storage.local.get({ hardwareMetricsLog: [] }, (result) => {
        let log = result.hardwareMetricsLog;
        const newSample = message.data;

        // Calculate Delta
        const lastSample = log[log.length - 1];
        const previousTotal = lastSample ? lastSample.totalUncorrectables : 0;

        // Calculate delta, ensuring we don't report negative if modem rebooted
        newSample.deltaUncorrectables = (newSample.totalUncorrectables >= previousTotal)
            ? (newSample.totalUncorrectables - previousTotal)
            : newSample.totalUncorrectables;

        // Append and save
        log.push(newSample);
        chrome.storage.local.set({ hardwareMetricsLog: log });
      });
    }

  if (message.type === "TRIGGER_DIAGNOSTIC_SCAN") {
    chrome.storage.local.get({ modemProfile: 'auto' }, (settings) => {
      let targetUrls = ["http://192.168.0.1/*", "http://192.168.100.1/*"];

      // If profile is set to a specific hardware option instead of auto-detecting
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
        chrome.tabs.reload(tabs[0].id, {}, () => {
          sendResponse({ status: "initiated" });
        });
      });
    });
    return true;
  }
});