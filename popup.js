// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const toggleLabel = document.getElementById('toggleStateLabel');
  const activeIndicator = document.getElementById('activeIndicator');

  const popupMinSNR = document.getElementById('popupMinSNR');
  const popupErrors = document.getElementById('popupErrors');

  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const quickSampleBtn = document.getElementById('quickSampleBtn');

  const iconPaths = {
    on: {
      "16": "icon-16.png",
      "32": "icon-32.png"
    },
    off: {
      "16": "icon-16-off.png",
      "32": "icon-32-off.png"
    }
  };

  chrome.storage.local.get({
    extensionEnabled: true,
    hardwareMetricsLog: []
  }, (data) => {
    if (extensionToggle) extensionToggle.checked = data.extensionEnabled;
    updateToggleUI(data.extensionEnabled);
    if (data.hardwareMetricsLog && data.hardwareMetricsLog.length > 0) {
      updatePopupMetricsDisplay(data.hardwareMetricsLog);
    }
  });

  if (extensionToggle) {
    extensionToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      chrome.storage.local.set({ extensionEnabled: isEnabled }, () => {
        updateToggleUI(isEnabled);
        chrome.action.setIcon({ path: isEnabled ? iconPaths.on : iconPaths.off });
        chrome.runtime.sendMessage({ type: 'TOGGLE_CHANGED', enabled: isEnabled }).catch(() => {});
      });
    });
  }

  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
      else window.open(chrome.runtime.getURL('options.html'));
    });
  }

  if (quickSampleBtn) {
    quickSampleBtn.addEventListener('click', () => {
      quickSampleBtn.innerText = "Scanning";
      quickSampleBtn.disabled = true;

      chrome.runtime.sendMessage({ type: 'TRIGGER_DIAGNOSTIC_SCAN' }, (response) => {
        if (chrome.runtime.lastError) { /* channel warm up */ }

        setTimeout(() => {
          quickSampleBtn.innerText = "🔄 Scan";
          quickSampleBtn.disabled = false;

          chrome.storage.local.get({ hardwareMetricsLog: [] }, (updatedData) => {
            if (updatedData.hardwareMetricsLog && updatedData.hardwareMetricsLog.length > 0) {
              updatePopupMetricsDisplay(updatedData.hardwareMetricsLog);
            }
          });
        }, 1500);
      });
    });
  }

function updatePopupMetricsDisplay(logArray) {
  if (!logArray || logArray.length === 0) return;

  const latestLog = logArray[logArray.length - 1];
  const previousLog = logArray.length > 1 ? logArray[logArray.length - 2] : null;

  // 1. Current SNR
  const currentSNR = latestLog.avgSNR ?? latestLog.minSNR;
  if (popupMinSNR && currentSNR !== undefined) {
    popupMinSNR.innerText = `${Number(currentSNR).toFixed(1)} dB`;
    popupMinSNR.style.color = currentSNR < 30 ? "#ef4444" : "#10b981";
  }

  // 2. Total Errors and Delta
  if (popupErrors) {
    const total = latestLog.totalUncorrectables || 0;

    // Calculate Delta: Current total minus previous total
    // (If this is the first sample, delta is 0)
    const delta = previousLog ? (total - (previousLog.totalUncorrectables || 0)) : 0;

    // Display total with delta in parentheses
    popupErrors.innerHTML = `${total.toLocaleString()}
      <span style="font-size: 0.8em; color: ${delta > 0 ? '#ef4444' : '#64748b'};">
        (+${delta})
      </span>`;
  }
}

  function updateToggleUI(enabled) {
    if (enabled) {
      if (toggleLabel) toggleLabel.innerText = "Extension Running";
      if (activeIndicator) {
        activeIndicator.innerText = "● Online";
        activeIndicator.style.color = "#10b981";
      }
    } else {
      if (toggleLabel) toggleLabel.innerText = "Extension Suspended";
      if (activeIndicator) {
        activeIndicator.innerText = "● Offline";
        activeIndicator.style.color = "#64748b";
      }
    }
  }
});