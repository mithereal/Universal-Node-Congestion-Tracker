chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ trackingEnabled: true }, (data) => {
    updateToolbarIcon(data.trackingEnabled);
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({ trackingEnabled: true }, (data) => {
    updateToolbarIcon(data.trackingEnabled);
  });
});

// 2. Listen for real-time storage updates from the popup toggle switch
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.trackingEnabled) {
    const isNowEnabled = changes.trackingEnabled.newValue;
    updateToolbarIcon(isNowEnabled);
  }
});

// 3. Icon Swap Core Engine
function updateToolbarIcon(isEnabled) {
  if (isEnabled) {
    // Inject your vibrant blue/red active iconography
    chrome.action.setIcon({
      path: {
        "16": "icon-16.png",
        "32": "icon-32.png"
      }
    }, () => {
      console.log("Universal Tracker: Extension bar icon updated to ACTIVE profile.");
    });
  } else {
    // Inject your muted grey deactivated iconography
    chrome.action.setIcon({
      path: {
        "16": "icon-16-off.png",
        "32": "icon-32-off.png"
      }
    }, () => {
      console.log("Universal Tracker: Extension bar icon updated to INACTIVE profile.");
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "SESSION_EXPIRED") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Action Required: Modem Logged Out",
      message: "Your modem session has expired. Please click your modem tab and log back in to resume tracking.",
      priority: 2
    });
    return;
  }

  if (message.type === "HARDWARE_METRICS") {
    const hardwareData = message.data;

    chrome.storage.local.get({ networkLogs: [] }, (data) => {
      const logs = data.networkLogs;

      logs.push({
        timestamp: hardwareData.capturedAt,
        minSNR: hardwareData.minSNR,
        uncorrectables: hardwareData.totalUncorrectables
      });

      // Retain roughly a rolling week of 5-minute tracking ticks (~2016 entries)
      if (logs.length > 2500) logs.shift();

      chrome.storage.local.set({ networkLogs: logs });
    });
  }
});