// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extensionToggle');
  const toggleLabel = document.getElementById('toggleStateLabel');
  const activeIndicator = document.getElementById('activeIndicator');

  const popupMinSNR = document.getElementById('popupMinSNR');
  const popupErrors = document.getElementById('popupErrors');

  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const quickSampleBtn = document.getElementById('quickSampleBtn');

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
      quickSampleBtn.innerText = "Scanning...";
      quickSampleBtn.disabled = true;

      chrome.runtime.sendMessage({ type: 'TRIGGER_DIAGNOSTIC_SCAN' }, (response) => {
        if (chrome.runtime.lastError) { /* channel warm up */ }

        setTimeout(() => {
          quickSampleBtn.innerText = "🔄 Force Diagnosis Scan";
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
    const latestLog = logArray[logArray.length - 1];
    if (!latestLog) return;

    if (popupMinSNR && latestLog.minSNR !== undefined) {
      popupMinSNR.innerText = `${Number(latestLog.minSNR).toFixed(1)} dB`;
    }
    if (popupErrors && latestLog.totalUncorrectables !== undefined) {
      popupErrors.innerText = Number(latestLog.totalUncorrectables).toLocaleString();
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