import { ModemRegistry } from './modems/registry.js';

let hardwareTelemetryLog = [];
let channelStorageLog = [];
let activeDataView = 'snr'; // Toggles views: 'snr' or 'channels'
let activeTabFilter = 'all';

let plottedCoordinatesCache = [];
let hoverStateNode = null;
let plottedPieSlicesCache = [];
let hoveredPieSlice = null;

const quickSampleBtn = document.getElementById('quickSampleBtn');
const DEFAULT_SETTINGS = { extensionEnabled: true, pollingInterval: 5, modemProfile: 'auto' };

const UI = {
  pollingIntervalSelect: document.getElementById('pollingIntervalSelect'),
  modemProfileSelect: document.getElementById('modemProfileSelect'),
  statSNRDisplay: document.getElementById('statSNRDisplay'),
  statErrors: document.getElementById('statErrors'),
  statSamples: document.getElementById('statSamples'),
  tabsContainer: document.getElementById('tabsContainer'),
  optionsChart: document.getElementById('optionsChart'),
  pieChart: document.getElementById('pieChart'),
  chartTooltip: document.getElementById('chartTooltip'),
  pieTooltip: document.getElementById('pieTooltip'),
  csvFileInput: document.getElementById('csvFileInput'),
  csvExportBtn: document.getElementById('csvExportBtn'),
  setBaselineBtn: document.getElementById('setBaselineBtn')
};

document.addEventListener('DOMContentLoaded', () => {
  setupBaselineListener();
  populateModemDropdown();
  loadStoredSettings();
  loadTelemetryData();
  setupEventListeners();
  listenForStorageChanges();
  setupThemeAutodetectListener();
});

function setupBaselineListener() {
  if (UI.setBaselineBtn) {
    UI.setBaselineBtn.addEventListener('click', establishBaseline);
  }
}

function establishBaseline() {
  if (hardwareTelemetryLog.length === 0) {
    alert("No telemetry data to establish a baseline from.");
    return;
  }
  const originalText = UI.setBaselineBtn.innerText;
  UI.setBaselineBtn.innerText = "🔄 Setting Baseline...";
  UI.setBaselineBtn.disabled = true;
  const latestSnapshot = hardwareTelemetryLog[hardwareTelemetryLog.length - 1];
  chrome.storage.local.set({
    baselineTelemetry: {
      timestamp: Date.now(),
      minSNR: latestSnapshot.minSNR,
      avgSNR: latestSnapshot.avgSNR,
      totalUncorrectables: latestSnapshot.totalUncorrectables
    }

  }, () => {
  UI.setBaselineBtn.innerText = "Baseline Set!";

      setTimeout(() => {
        UI.setBaselineBtn.innerText = originalText;
        UI.setBaselineBtn.disabled = false;
    // Refresh the UI to reflect the new baseline in the charts/labels
          updateMetricsDashboard();
        }, 1200);
  });
}

function loadTelemetryData() {
  chrome.storage.local.get({ hardwareMetricsLog: [], channelStorageLog: [] }, (result) => {
    hardwareTelemetryLog = result.hardwareMetricsLog || [];
    channelStorageLog = result.channelStorageLog || [];
    buildTabSelectors();
    updateMetricsDashboard();
    renderDataVisualizations();
  });
}

function listenForStorageChanges() {
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.hardwareMetricsLog) hardwareTelemetryLog = changes.hardwareMetricsLog.newValue || [];
    if (changes.channelStorageLog) channelStorageLog = changes.channelStorageLog.newValue || [];
    buildTabSelectors();
    updateMetricsDashboard();
    renderDataVisualizations();
  });
}

function buildTabSelectors() {
  UI.tabsContainer.innerHTML = '';

  // Primary Time Range Selectors Group
  const ranges = [{ label: 'All Samples', filter: 'all' }, { label: 'Past 1H', filter: '1h' }];
  ranges.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${activeTabFilter === tab.filter && activeDataView === 'snr' ? 'active' : ''}`;
    btn.innerText = tab.label;
    btn.addEventListener('click', () => {
      activeDataView = 'snr';
      activeTabFilter = tab.filter;
      buildTabSelectors();
      renderDataVisualizations();
    });
    UI.tabsContainer.appendChild(btn);
  });

  // Inject Channel View link if granular telemetry array data is present
  if (channelStorageLog.length > 0) {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${activeDataView === 'channels' ? 'active' : ''}`;
    btn.innerText = '⚠️ Channel Matrix';
    btn.addEventListener('click', () => {
      activeDataView = 'channels';
      buildTabSelectors();
      renderDataVisualizations();
    });
    UI.tabsContainer.appendChild(btn);
  }
}

function getFilteredTelemetry() {
  if (activeDataView === 'channels') return hardwareTelemetryLog;
  const now = Date.now();
  return hardwareTelemetryLog.filter(log => {
    if (activeTabFilter === '1h') return (now - log.capturedAt) <= 3600000;
    return true;
  });
}

function updateMetricsDashboard() {
  const sampleCount = hardwareTelemetryLog.length;
  UI.statSamples.innerText = sampleCount;

  if (sampleCount === 0) return;

  const currentLog = hardwareTelemetryLog[hardwareTelemetryLog.length - 1];
  if (UI.statSNRDisplay) {
    UI.statSNRDisplay.innerText = `${currentLog.minSNR ? currentLog.minSNR.toFixed(1) : '--'} / ${currentLog.avgSNR ? currentLog.avgSNR.toFixed(1) : '--'} dB`;
  }

  const filteredErrorsSum = hardwareTelemetryLog.reduce((accum, log) => accum + (log.deltaUncorrectables || 0), 0);

  chrome.storage.local.get(['baselineTelemetry'], (res) => {
    const baseline = res.baselineTelemetry;
    let errorDisplay = filteredErrorsSum.toLocaleString();

    if (baseline) {
      const errorsSinceBaseline = currentLog.totalUncorrectables - baseline.totalUncorrectables || 0;
      errorDisplay += ` <span style="font-size:0.75em; opacity:0.75; color:#ef4444;">(+${errorsSinceBaseline.toLocaleString()} since base)</span>`;
    }
    UI.statErrors.innerHTML = errorDisplay;
  });
}

function renderDataVisualizations() {
  // 1. Get filtered data based on active tab ('all' or '1h')
  const data = getFilteredTelemetry();

  // 2. Calculate node-wide averages for reference
  // Note: We use hardwareTelemetryLog for the average to maintain a stable baseline,
  // while using 'data' for the chart visualization to respect user filters.
  const totalErrors = hardwareTelemetryLog.reduce((sum, log) => sum + (log.totalUncorrectables || 0), 0);
  const avgErrors = hardwareTelemetryLog.length > 0 ? (totalErrors / hardwareTelemetryLog.length) : 0;

  const thresholdLabel = document.getElementById('errorThresholdLabel');
  if (thresholdLabel) {
    thresholdLabel.innerText = `Node Average Window Base: > ${avgErrors.toFixed(1)} Errors`;
  }

  // 3. Render charts with filtered data
  // The line chart will show the trend for the selected time range
  renderTimelinePerformanceChart(data);

  // The pie chart will show the error distribution (delta heat-map) for the selected time range
  renderBoundaryDistributionPieChart(data);
}

function renderTimelinePerformanceChart(dataset) {
  const canvasCtx = UI.optionsChart.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const computedWidth = UI.optionsChart.parentElement.clientWidth || 600;

  UI.optionsChart.width = computedWidth * dpr;
  UI.optionsChart.height = 220 * dpr;
  UI.optionsChart.style.height = `220px`;
  canvasCtx.scale(dpr, dpr);
  canvasCtx.clearRect(0, 0, computedWidth, 220);

  plottedCoordinatesCache = [];
  if (dataset.length === 0) return;

  const padding = { top: 20, right: 20, bottom: 30, left: 45 };
  const graphW = computedWidth - padding.left - padding.right;
  const graphH = 220 - padding.top - padding.bottom;
  const isChannelView = activeDataView === 'channels';

  // 1. Calculate Bounds (Dynamic Zoom)
  let maxVal, minVal;
  if (isChannelView) {
    const channelSnrValues = channelStorageLog.flatMap(l => l.channels.map(c => c.snr));
    minVal = Math.floor(Math.min(...channelSnrValues) - 1);
    maxVal = Math.ceil(Math.max(...channelSnrValues) + 1);
  } else {
    const metricValues = dataset.map(d => d.avgSNR);
    maxVal = Math.max(...metricValues, 45);
    minVal = Math.max(0, Math.min(...metricValues, 25) - 2);
  }

  // 2. Draw Grid & Y-Axis Labels
  canvasCtx.fillStyle = getActiveThemePalette().text;
  canvasCtx.font = "10px sans-serif";
  canvasCtx.textAlign = "right";
  for (let i = 0; i <= 2; i++) {
    const val = minVal + (maxVal - minVal) * (i / 2);
    const y = padding.top + graphH * (1 - (val - minVal) / (maxVal - minVal));
    canvasCtx.strokeStyle = getActiveThemePalette().grid;
    canvasCtx.beginPath();
    canvasCtx.moveTo(padding.left, y);
    canvasCtx.lineTo(padding.left + graphW, y);
    canvasCtx.stroke();
    canvasCtx.fillText(val.toFixed(1) + " dB", padding.left - 5, y + 3);
  }

  // 3. Render Data
  if (isChannelView) {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
    const channels = {};
    channelStorageLog.forEach(log => {
      log.channels.forEach((ch, idx) => {
        if (!channels[idx]) channels[idx] = [];
        channels[idx].push({ x: log.capturedAt, y: ch.snr });
      });
    });

    Object.keys(channels).forEach((chId, i) => {
      const points = channels[chId];
      canvasCtx.beginPath();
      canvasCtx.strokeStyle = colors[i % colors.length];
      canvasCtx.lineWidth = 1.5;

      points.forEach((pt, idx) => {
        const x = padding.left + ((pt.x - dataset[0].capturedAt) / (dataset[dataset.length-1].capturedAt - dataset[0].capturedAt || 1)) * graphW;
        const y = padding.top + graphH * (1 - (pt.y - minVal) / (maxVal - minVal || 1));
        idx === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);

        // Push dots for hover
        plottedCoordinatesCache.push({ x, y, data: { snr: pt.y, channelId: chId } });
      });
      canvasCtx.stroke();

      // Draw dots
      points.forEach((pt) => {
        const x = padding.left + ((pt.x - dataset[0].capturedAt) / (dataset[dataset.length-1].capturedAt - dataset[0].capturedAt || 1)) * graphW;
        const y = padding.top + graphH * (1 - (pt.y - minVal) / (maxVal - minVal || 1));
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 3, 0, Math.PI * 2);
        canvasCtx.fillStyle = colors[i % colors.length];
        canvasCtx.fill();
      });
    });
  } else {
    // Single SNR line
    dataset.forEach((log, idx) => {
      const x = padding.left + (idx / (dataset.length - 1 || 1)) * graphW;
      const y = padding.top + graphH * (1 - (log.avgSNR - minVal) / (maxVal - minVal || 1));
      plottedCoordinatesCache.push({ x, y, data: log });
    });

    canvasCtx.beginPath();
    canvasCtx.strokeStyle = getActiveThemePalette().primary;
    canvasCtx.lineWidth = 2.5;
    plottedCoordinatesCache.forEach((pt, idx) => idx === 0 ? canvasCtx.moveTo(pt.x, pt.y) : canvasCtx.lineTo(pt.x, pt.y));
    canvasCtx.stroke();

    plottedCoordinatesCache.forEach((pt) => {
      canvasCtx.beginPath();
      canvasCtx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      canvasCtx.fillStyle = getActiveThemePalette().pointStroke;
      canvasCtx.fill();
      canvasCtx.stroke();
    });
  }
}

function handleChartMouseMove(e) {
  const rect = UI.optionsChart.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  let closestNode = null;
  let minDistance = 20;

  plottedCoordinatesCache.forEach(pt => {
    const distance = Math.abs(mouseX - pt.x);
    if (distance < minDistance) {
      minDistance = distance;
      closestNode = pt;
    }
  });

  if (closestNode) {
    const idx = plottedCoordinatesCache.indexOf(closestNode);
    const log = closestNode.data;
    const prevLog = idx > 0 ? plottedCoordinatesCache[idx - 1].data : null;

    // Delta tracking calculations
    const snrDelta = prevLog ? (log.avgSNR - prevLog.avgSNR).toFixed(2) : "0.00";
    const errDelta = prevLog ? (log.totalUncorrectables - prevLog.totalUncorrectables) : 0;

    const timeStr = new Date(log.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    UI.chartTooltip.innerHTML = `
      <div style="font-weight:bold; margin-bottom:4px; color:#fff;">${timeStr}</div>
      <div><b>Avg SNR:</b> ${log.avgSNR.toFixed(2)} dB (Δ: ${snrDelta > 0 ? '+' : ''}${snrDelta})</div>
      <div><b>Uncorrectables:</b> ${log.totalUncorrectables.toLocaleString()} (Δ: ${errDelta > 0 ? '+' : ''}${errDelta})</div>
      ${log.channelsScanned ? `<div><b>Active Channels:</b> ${log.channelsScanned}</div>` : ''}
    `;
    UI.chartTooltip.style.display = 'block';
    UI.chartTooltip.style.left = `${closestNode.x + 15}px`;
    UI.chartTooltip.style.top = `${closestNode.y - 45}px`;
  } else {
    UI.chartTooltip.style.display = 'none';
  }
}

function renderBoundaryDistributionPieChart(dataset) {
  const canvasCtx = UI.pieChart.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = UI.pieChart.parentElement.clientWidth || 250;

  UI.pieChart.width = w * dpr;
  UI.pieChart.height = 180 * dpr;
  UI.pieChart.style.height = `180px`;
  canvasCtx.scale(dpr, dpr);
  canvasCtx.clearRect(0, 0, w, 180);

  plottedPieSlicesCache = [];

  // Filter for samples with errors, or show all if you want to see "clean" slices
  const samples = dataset;
  if (samples.length === 0) return;

  // Find the highest delta for the color scale
  const maxDelta = Math.max(...samples.map(d => d.deltaUncorrectables || 0), 1);

  const sliceAngle = (Math.PI * 2) / samples.length;
  let currentAngle = -Math.PI / 2;
  const cX = w / 2, cY = 90, baseRadius = 55;

  samples.forEach((log) => {
    const delta = log.deltaUncorrectables || 0;

    // Normalize color: 0 errors = Green (34, 197, 84), Max Errors = Red (220, 35, 35)
    const ratio = delta / maxDelta;
    const r = Math.floor(34 + (ratio * 186));
    const g = Math.floor(197 - (ratio * 162));
    const b = Math.floor(84 - (ratio * 49));
    const segmentColor = `rgb(${r},${g},${b})`;

    canvasCtx.beginPath();
    canvasCtx.moveTo(cX, cY);
    canvasCtx.arc(cX, cY, baseRadius, currentAngle, currentAngle + sliceAngle);
    canvasCtx.closePath();
    canvasCtx.fillStyle = segmentColor;
    canvasCtx.fill();

    plottedPieSlicesCache.push({
      timeLabel: new Date(log.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      delta: delta,
      total: log.totalUncorrectables,
      color: segmentColor,
      startAngle: currentAngle,
      endAngle: currentAngle + sliceAngle
    });

    currentAngle += sliceAngle;
  });
}

function handlePieMouseMove(e) {
  const rect = UI.pieChart.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const cX = rect.width / 2, cY = 90;

  const distance = Math.sqrt((mouseX - cX)**2 + (mouseY - cY)**2);
  let mouseAngle = Math.atan2(mouseY - cY, mouseX - cX);
  if (mouseAngle < -Math.PI / 2) mouseAngle += Math.PI * 2;

  let matchNode = null;
  if (distance <= 65 && distance > 5) {
    plottedPieSlicesCache.forEach(slice => {
      // Handle the angle wrapping at the top (PI)
      if (mouseAngle >= slice.startAngle && mouseAngle <= slice.endAngle) matchNode = slice;
    });
  }

  if (matchNode) {
    UI.pieTooltip.innerHTML = `
      <div style="font-weight:bold; border-bottom:1px solid #444;">${matchNode.timeLabel}</div>
      <div style="color: ${matchNode.color}; font-weight: bold;">Delta: +${matchNode.delta.toLocaleString()}</div>
      <div style="font-size: 11px;">Total: ${matchNode.total.toLocaleString()}</div>
    `;
    UI.pieTooltip.style.display = 'block';
    UI.pieTooltip.style.left = `${mouseX + 15}px`;
    UI.pieTooltip.style.top = `${mouseY - 25}px`;
  } else {
    UI.pieTooltip.style.display = 'none';
  }
}

function setupEventListeners() {
  if (UI.pollingIntervalSelect) UI.pollingIntervalSelect.addEventListener('change', (e) => saveSetting('pollingInterval', parseInt(e.target.value, 10)));
  if (UI.modemProfileSelect) UI.modemProfileSelect.addEventListener('change', (e) => saveSetting('modemProfile', e.target.value));

  if (UI.optionsChart) {
    UI.optionsChart.addEventListener('mousemove', handleChartMouseMove);
    UI.optionsChart.addEventListener('mouseleave', () => UI.chartTooltip.style.display = 'none');
  }
  if (UI.pieChart) {
    UI.pieChart.addEventListener('mousemove', handlePieMouseMove);
    UI.pieChart.addEventListener('mouseleave', () => UI.pieTooltip.style.display = 'none');
  }

  if (UI.csvExportBtn) UI.csvExportBtn.addEventListener('click', exportFullStorage);
  if (UI.csvFileInput) UI.csvFileInput.addEventListener('change', importFullStorage);
}

function populateModemDropdown() {
  if (!UI.modemProfileSelect) return;
  UI.modemProfileSelect.innerHTML = '<option value="auto">Auto-Detect Brand</option>';
  ModemRegistry.forEach(modem => {
    const option = document.createElement('option');
    option.value = modem.id;
    option.innerText = modem.name;
    UI.modemProfileSelect.appendChild(option);
  });
}

function loadStoredSettings() {
  chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
    if (UI.pollingIntervalSelect) UI.pollingIntervalSelect.value = settings.pollingInterval;
    if (UI.modemProfileSelect) UI.modemProfileSelect.value = settings.modemProfile;
  });
}

function saveSetting(key, value) {
  chrome.storage.local.set({ [key]: value });
}

function setupThemeAutodetectListener() {
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  try {
    darkQuery.addEventListener('change', () => renderDataVisualizations());
  } catch (e) {
    darkQuery.addListener(() => renderDataVisualizations());
  }
}

function getActiveThemePalette() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    text: isDark ? "#94a3b8" : "#64748b",
    grid: isDark ? "#334155" : "#e2e8f0",
    primary: isDark ? "#3b82f6" : "#2563eb",
    pointStroke: isDark ? "#1e293b" : "#ffffff"
  };
}


const donateModal = document.getElementById('donateModal');
const openDonateBtn = document.getElementById('openDonateModalBtn');
const closeDonateBtn = document.getElementById('closeDonateModalBtn');
if (openDonateBtn && donateModal) openDonateBtn.addEventListener('click', () => donateModal.style.display = 'flex');
if (closeDonateBtn && donateModal) closeDonateBtn.addEventListener('click', () => donateModal.style.display = 'none');
if (quickSampleBtn) {
  quickSampleBtn.addEventListener('click', () => {
    // 1. Enter "Scanning" state
    const originalText = quickSampleBtn.innerText;
    quickSampleBtn.innerText = "scanning";
    quickSampleBtn.disabled = true;

    // 2. Trigger the diagnostic scan
    chrome.runtime.sendMessage({ type: 'TRIGGER_DIAGNOSTIC_SCAN' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Scan failed:", chrome.runtime.lastError.message);
      }

      // 3. Wait for the scan/data processing to complete
      setTimeout(() => {
        // 4. Return to original state
        quickSampleBtn.innerText = originalText;
        quickSampleBtn.disabled = false;

        // 5. Fetch updated data and refresh UI
        chrome.storage.local.get({ hardwareMetricsLog: [] }, (updatedData) => {
          if (updatedData.hardwareMetricsLog && updatedData.hardwareMetricsLog.length > 0) {
            updatePopupMetricsDisplay(updatedData.hardwareMetricsLog);
          }
        });
      }, 2000); // 2-second buffer for the modem to respond and save data
    });
  });
}
  // Add this to options.js
  document.addEventListener('click', (e) => {
    // 1. Target the button via class or ID
    const isCopyBtn = e.target.classList.contains('copy-btn') ||
                      e.target.id === 'copyBtcBtn' ||
                      e.target.id === 'copyEthBtn';

    if (isCopyBtn) {
      // 2. Find the associated input field (sibling or by ID)
      const container = e.target.closest('.crypto-row');
      const input = container ? container.querySelector('input') : null;

      if (input) {
        navigator.clipboard.writeText(input.value).then(() => {
          // 3. Visual feedback
          const originalText = e.target.innerText;
          e.target.innerText = "Copied!";
          e.target.style.backgroundColor = "#10b981"; // Success green
          e.target.style.color = "#ffffff";

          setTimeout(() => {
            e.target.innerText = originalText;
            e.target.style.backgroundColor = "";
            e.target.style.color = "";
          }, 2000);
        }).catch(err => {
          console.error('Clipboard write failed:', err);
        });
      }
    }
  });

  /**
   * Exports the entire contents of chrome.storage.local to a JSON file.
   * This ensures that logs, baseline telemetry, and extension settings
   * are all backed up together.
   */
  async function exportFullStorage() {
    // 1. Fetch all data currently held in local storage
    chrome.storage.local.get(null, (allData) => {
      // 2. Serialize data to a formatted JSON string
      const dataStr = JSON.stringify(allData, null, 2);

      // 3. Create a blob for the file content
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // 4. Create an anchor element to simulate a user click
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `node_tracker_backup_${timestamp}.json`;

      // 5. Append, trigger, and cleanup
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up the object URL to save memory
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Imports a JSON file and overwrites the extension's local storage.
   * @param {File} file - The file object selected from the input.
   */
  function importFullStorage(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        // 1. Parse the JSON content
        const importedData = JSON.parse(e.target.result);

        // 2. Clear current storage and set the new data
        // Alternatively, use chrome.storage.local.set(importedData)
        // to merge instead of overwriting
        chrome.storage.local.set(importedData, () => {
          if (chrome.runtime.lastError) {
            alert("Error importing data: " + chrome.runtime.lastError.message);
          } else {
            alert("Storage successfully restored!");
            // 3. Reload the page to refresh charts with the new data
            window.location.reload();
          }
        });
      } catch (err) {
        console.error("Failed to parse backup file:", err);
        alert("Invalid file format. Please ensure you are uploading a valid JSON backup.");
      }
    };

    // Start reading the file
    reader.readAsText(file);
  }