// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const toggleLabel = document.getElementById('toggleStateLabel');
  const activeIndicator = document.getElementById('activeIndicator');

  const snrValueText = document.getElementById('popupMinSNR');
  const errorValueText = document.getElementById('popupErrors');

  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const quickSampleBtn = document.getElementById('quickSampleBtn');

  // 1. Hydrate UI State safely from Local Storage
  chrome.storage.local.get({
    extensionEnabled: true,
    networkLogs: []
  }, (data) => {

    // Set up master switch state if element exists
    if (extensionToggle) {
      extensionToggle.checked = data.extensionEnabled;
    }
    updateToggleUI(data.extensionEnabled);

    // Calculate real-time snapshot metrics from the most recent trace frame
    if (data.networkLogs && data.networkLogs.length > 0) {
      const latestLog = data.networkLogs[data.networkLogs.length - 1];

      if (latestLog && snrValueText && latestLog.minSNR !== undefined) {
        snrValueText.innerText = `${Number(latestLog.minSNR).toFixed(1)} dB`;
      }
      if (latestLog && errorValueText && latestLog.uncorrectables !== undefined) {
        errorValueText.innerText = Number(latestLog.uncorrectables).toLocaleString();
      }
    }
  });

  // 2. Handle Extension Enable/Disable Toggle Shifts
  if (extensionToggle) {
    extensionToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;

      chrome.storage.local.set({ extensionEnabled: isEnabled }, () => {
        updateToggleUI(isEnabled);

        // Broadcast state changes globally to background.js or active tabs
        chrome.runtime.sendMessage({ type: 'TOGGLE_CHANGED', enabled: isEnabled }, () => {
          // Catch and clear runtime errors silently if background listeners are asleep
          if (chrome.runtime.lastError) { /* logging suppressed */ }
        });
      });
    });
  }

  // 3. Open Options Dashboard Button Click Link
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    });
  }

  // 4. Force Diagnostic Scan Pipeline
  if (quickSampleBtn) {
    quickSampleBtn.addEventListener('click', () => {
      quickSampleBtn.innerText = "Scanning...";
      quickSampleBtn.disabled = true;
      // Ping background network listener scripts to trigger an on-demand metrics pass
      chrome.runtime.sendMessage({ type: 'TRIGGER_DIAGNOSTIC_SCAN' }, (response) => {
        // Clear runtime error if background script didn't answer in time
        if (chrome.runtime.lastError) { /* logging suppressed */ }

        setTimeout(() => {
          quickSampleBtn.innerText = "🔄 Force Diagnosis Scan";
          quickSampleBtn.disabled = false;



          // Re-read local storage to print updated metrics pass values
          chrome.storage.local.get({ networkLogs: [] }, (updatedData) => {
            if (updatedData.networkLogs && updatedData.networkLogs.length > 0) {
              const recent = updatedData.networkLogs[updatedData.networkLogs.length - 1];
              if (snrValueText && recent.minSNR !== undefined) {
                snrValueText.innerText = `${Number(recent.minSNR).toFixed(1)} dB`;
              }
              if (errorValueText && recent.uncorrectables !== undefined) {
                errorValueText.innerText = Number(recent.uncorrectables).toLocaleString();
              }
            }
          });
        }, 1000);
      });
    });
  }

  // Helper function to update visual indicator classes safely
  function updateToggleUI(enabled) {
    if (enabled) {
      if (toggleLabel) toggleLabel.innerText = "Extension Running";
      if (activeIndicator) {
        activeIndicator.innerText = "● Online";
        activeIndicator.style.color = "#10b981"; // Emerald green
      }
      chrome.action.setIcon({
              path: {
                "16": "icon-16.png",
                "32": "icon-32.png"
              }
            });
    } else {
      if (toggleLabel) toggleLabel.innerText = "Extension Suspended";
      if (activeIndicator) {
        activeIndicator.innerText = "● Offline";
        activeIndicator.style.color = "#64748b"; // Muted Slate
      }
      chrome.action.setIcon({
              path: {
                "16": "icon-16-off.png",
                "32": "icon-32-off.png"
              }
            });
    }
  }
});