// options.js
import { ModemRegistry } from './modems/registry.js';

let hardwareTelemetryLog = [];
let activeTabFilter = 'all';


// Graphic Vector & Coordinate States
let plottedCoordinatesCache = [];
let hoverStateNode = null;
let plottedPieSlicesCache = [];
let hoveredPieSlice = null;

const quickSampleBtn = document.getElementById('quickSampleBtn');

const DEFAULT_SETTINGS = {
  extensionEnabled: true,
  pollingInterval: 5,
  modemProfile: 'auto'
};

const UI = {
  pollingIntervalSelect: document.getElementById('pollingIntervalSelect'),
  modemProfileSelect: document.getElementById('modemProfileSelect'),
  statMinSNR: document.getElementById('statMinSNR'),
  statErrors: document.getElementById('statErrors'),
  statSamples: document.getElementById('statSamples'),
  tabsContainer: document.getElementById('tabsContainer'),
  optionsChart: document.getElementById('optionsChart'),
  pieChart: document.getElementById('pieChart'),
  pieMetricSelect: document.getElementById('pieMetricSelect'),
  chartTooltip: document.getElementById('chartTooltip'),
  pieTooltip: document.getElementById('pieTooltip'),
  csvFileInput: document.getElementById('csvFileInput'),
  setBaselineBtn: document.getElementById('setBaselineBtn')
};

document.addEventListener('DOMContentLoaded', () => {
  setupBaselineListener(); // Ensure this was called
  populateModemDropdown();
  loadStoredSettings();
  loadTelemetryData();
  setupEventListeners();
  buildTabSelectors();
  listenForStorageChanges();
  setupThemeAutodetectListener();
});

// 1. Trigger the baseline capture
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

  // Get the most recent capture
  const latestSnapshot = hardwareTelemetryLog[hardwareTelemetryLog.length - 1];

  // Store in chrome.storage
  chrome.storage.local.set({
    baselineTelemetry: {
      timestamp: Date.now(),
      minSNR: latestSnapshot.minSNR,
      avgSNR: latestSnapshot.avgSNR,
      totalCorrectables: latestSnapshot.totalCorrectables,
      totalUncorrectables: latestSnapshot.totalUncorrectables
    }
  }, () => {
    alert("Baseline established at " + new Date().toLocaleTimeString());
    renderDataVisualizations(); // Optional: trigger a redraw
  });
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

function listenForStorageChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.hardwareMetricsLog) {
      hardwareTelemetryLog = changes.hardwareMetricsLog.newValue || [];
      updateMetricsDashboard();
      renderDataVisualizations();
    }
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

function loadTelemetryData() {
  chrome.storage.local.get({ hardwareMetricsLog: [] }, (result) => {
    hardwareTelemetryLog = result.hardwareMetricsLog || [];
    updateMetricsDashboard();
    renderDataVisualizations();
  });
}

/**
 * Updates the dashboard metrics.
 * If a filtered dataset is provided, it calculates metrics based on that view.
 * @param {Array|null} dataset - The filtered telemetry data (optional).
 */
/**
 * Updates the dashboard metrics, including SNR comparisons,
 * cumulative errors, and baseline drift.
 * @param {Array|null} dataset - The filtered telemetry data (optional).
 */
function updateMetricsDashboard(dataset = null) {
  const data = dataset || hardwareTelemetryLog;
  const sampleCount = data.length;

  UI.statSamples.innerText = sampleCount;

  // Handle empty state
  if (sampleCount === 0) {
    const snrDisplay = document.getElementById('statSNRDisplay');
    if (snrDisplay) snrDisplay.innerText = "-- / -- dB";
    UI.statErrors.innerText = "0";
    return;
  }

  // 1. SNR Metrics
  const currentLog = data[data.length - 1];
  const currentSNR = currentLog.avgSNR ? currentLog.avgSNR.toFixed(1) : "--";
  const allRecordedMinSNRs = data.map(log => parseFloat(log.minSNR)).filter(val => !isNaN(val) && val > 0);
  const absoluteWorstSNR = allRecordedMinSNRs.length > 0 ? Math.min(...allRecordedMinSNRs) : null;
  const histText = absoluteWorstSNR ? absoluteWorstSNR.toFixed(1) : "--";

  const snrDisplay = document.getElementById('statSNRDisplay');
  if (snrDisplay) {
    snrDisplay.innerText = `${histText} / ${currentSNR} dB`;
    snrDisplay.style.color = (currentLog.avgSNR < 30) ? "#dc2626" : "var(--text-title)";
  }

  // 2. Cumulative/Delta Error Metrics
  // We use deltaUncorrectables for accuracy, falling back to total if delta missing
  const filteredErrorsSum = data.reduce((accum, log) => accum + (log.deltaUncorrectables || log.totalUncorrectables || 0), 0);

  // 3. Baseline Drift Calculation
  chrome.storage.local.get(['baselineTelemetry'], (res) => {
    const baseline = res.baselineTelemetry;
    let errorDisplay = filteredErrorsSum.toLocaleString();

    if (baseline) {
      const errorsSinceBaseline = currentLog.totalUncorrectables - baseline.totalUncorrectables;
      errorDisplay += ` <span style="font-size:0.8em; opacity:0.7;">(+${errorsSinceBaseline.toLocaleString()} since base)</span>`;
    }

    UI.statErrors.innerHTML = errorDisplay;
  });
}
function setupEventListeners() {
  if (UI.pollingIntervalSelect) UI.pollingIntervalSelect.addEventListener('change', (e) => saveSetting('pollingInterval', parseInt(e.target.value, 10)));
  if (UI.modemProfileSelect) UI.modemProfileSelect.addEventListener('change', (e) => saveSetting('modemProfile', e.target.value));
  if (UI.pieMetricSelect) UI.pieMetricSelect.addEventListener('change', () => renderDataVisualizations());
  UI.csvExportBtn.addEventListener('click', exportTelemetryToCSV);
  UI.csvFileInput.addEventListener('change', importTelemetryFromCSV);
  if (UI.optionsChart) {
    UI.optionsChart.addEventListener('mousemove', handleChartMouseMove);
    UI.optionsChart.addEventListener('mouseleave', () => {
      hoverStateNode = null;
      if (UI.chartTooltip) UI.chartTooltip.style.display = 'none';
      renderTimelinePerformanceChart(getFilteredTelemetry());
    });
  }
  if (UI.pieChart) {
    UI.pieChart.addEventListener('mousemove', handlePieMouseMove);
    UI.pieChart.addEventListener('mouseleave', () => {
      hoveredPieSlice = null;
      if (UI.pieTooltip) UI.pieTooltip.style.display = 'none';
      renderBoundaryDistributionPieChart(getFilteredTelemetry());
    });
  }
}

function exportTelemetryToCSV() {
  if (hardwareTelemetryLog.length === 0) return;
  const headers = ["Timestamp", "ISODate", "ChannelsScanned", "MinSNR", "AvgSNR", "TotalCorrectables", "TotalUncorrectables"];
  const rows = hardwareTelemetryLog.map(log => [log.capturedAt, new Date(log.capturedAt).toISOString(), log.channelsScanned || 0, log.minSNR || 0, log.avgSNR || 0, log.totalCorrectables || 0, log.totalUncorrectables || 0]);
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", encodeURI(csvContent));
  downloadAnchor.setAttribute("download", `node_congestion_metrics_${Date.now()}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  document.body.removeChild(downloadAnchor);
}

function importTelemetryFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    const lines = e.target.result.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const importedArrayLog = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",");
      if (parts.length >= 7) {
        importedArrayLog.push({ capturedAt: parseInt(parts[0], 10), channelsScanned: parseInt(parts[2], 10) || 0, minSNR: parseFloat(parts[3]) || 0, avgSNR: parseFloat(parts[4]) || 0, totalCorrectables: parseInt(parts[5], 10) || 0, totalUncorrectables: parseInt(parts[6], 10) || 0 });
      }
    }
    if (importedArrayLog.length > 0 && confirm(`Import ${importedArrayLog.length} logs?`)) {
      chrome.storage.local.set({ hardwareMetricsLog: importedArrayLog }, () => {
        hardwareTelemetryLog = importedArrayLog;
        updateMetricsDashboard();
        renderDataVisualizations();
      });
    }
  };
  fileReader.readAsText(file);
}

function buildTabSelectors() {
  const intervals = [{ label: 'All Samples', filter: 'all' }, { label: 'Past 1H', filter: '1h' }, { label: 'Past 24H', filter: '24h' }];
  UI.tabsContainer.innerHTML = '';
  intervals.forEach((tab, index) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
    btn.innerText = tab.label;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTabFilter = tab.filter;
      renderDataVisualizations();
    });
    UI.tabsContainer.appendChild(btn);
  });
}

function getFilteredTelemetry() {
  const now = Date.now();
  // Calculate global average uncorrectables across the entire history
  const totalErrors = hardwareTelemetryLog.reduce((sum, log) => sum + (log.totalUncorrectables || 0), 0);
  const avgErrors = hardwareTelemetryLog.length > 0 ? (totalErrors / hardwareTelemetryLog.length) : 0;

  return hardwareTelemetryLog.filter(log => {
    // Apply time filters
    const timeFilter = activeTabFilter === '1h' ? (now - log.capturedAt) <= 3600000 : true;

    // Apply "Above Average" error filter
    const errorFilter = activeTabFilter === 'errors'
      ? (log.totalUncorrectables > avgErrors && log.totalUncorrectables > 0)
      : true;

    return timeFilter && errorFilter;
  });
}

function renderDataVisualizations() {
  const totalErrors = hardwareTelemetryLog.reduce((sum, log) => sum + (log.totalUncorrectables || 0), 0);
  const avgErrors = hardwareTelemetryLog.length > 0 ? (totalErrors / hardwareTelemetryLog.length) : 0;
  const thresholdLabel = document.getElementById('errorThresholdLabel');

  if (thresholdLabel) {
    thresholdLabel.innerText = `Threshold: > ${avgErrors.toFixed(1)} errors`;
  }
  const data = getFilteredTelemetry();
  renderTimelinePerformanceChart(data);
  renderBoundaryDistributionPieChart(data);
}

function renderTimelinePerformanceChart(dataset) {
  const canvasCtx = UI.optionsChart.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const computedWidth = UI.optionsChart.parentElement.clientWidth;
  const palette = getActiveThemePalette();
  UI.optionsChart.width = computedWidth * dpr;
  UI.optionsChart.height = 220 * dpr;
  UI.optionsChart.style.width = `${computedWidth}px`;
  UI.optionsChart.style.height = `220px`;
  canvasCtx.scale(dpr, dpr);
  canvasCtx.clearRect(0, 0, computedWidth, 220);
  plottedCoordinatesCache = [];
  if (dataset.length === 0) {
    canvasCtx.fillStyle = palette.text;
    canvasCtx.font = "13px sans-serif";
    canvasCtx.textAlign = "center";
    canvasCtx.fillText("No matching telemetry trend snapshots found.", computedWidth / 2, 110);
    return;
  }
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };
  const graphW = computedWidth - padding.left - padding.right;
  const graphH = 220 - padding.top - padding.bottom;
  const activeSnrArr = dataset.map(d => d.avgSNR);
  const maxSNR = Math.max(...activeSnrArr, 45);
  const minSNR = Math.max(0, Math.min(...activeSnrArr, 25) - 2);
  canvasCtx.strokeStyle = palette.grid;
  canvasCtx.fillStyle = palette.text;
  canvasCtx.font = "10px sans-serif";
  canvasCtx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const y = padding.top + graphH * (1 - ratio);
    const val = minSNR + ratio * (maxSNR - minSNR);
    canvasCtx.beginPath();
    canvasCtx.moveTo(padding.left, y);
    canvasCtx.lineTo(computedWidth - padding.right, y);
    canvasCtx.stroke();
    canvasCtx.fillText(`${val.toFixed(0)}dB`, padding.left - 8, y + 3);
  }
  dataset.forEach((log, idx) => {
    const x = padding.left + (idx / (dataset.length - 1 || 1)) * graphW;
    const normY = (log.avgSNR - minSNR) / (maxSNR - minSNR);
    const y = padding.top + graphH * (1 - normY);
    plottedCoordinatesCache.push({ x, y, data: log });
  });
  canvasCtx.beginPath();
  canvasCtx.lineWidth = 2.5;
  canvasCtx.strokeStyle = palette.primary;
  plottedCoordinatesCache.forEach((pt, idx) => {
    if (idx === 0) canvasCtx.moveTo(pt.x, pt.y);
    else canvasCtx.lineTo(pt.x, pt.y);
  });
  canvasCtx.stroke();
  plottedCoordinatesCache.forEach((pt) => {
    const isHovered = (hoverStateNode && hoverStateNode.x === pt.x && hoverStateNode.y === pt.y);
    canvasCtx.beginPath();
    canvasCtx.arc(pt.x, pt.y, isHovered ? 6 : 3.5, 0, Math.PI * 2);
    canvasCtx.fillStyle = isHovered ? "#ef4444" : palette.primary;
    canvasCtx.strokeStyle = palette.pointStroke;
    canvasCtx.lineWidth = 1.5;
    canvasCtx.fill();
    canvasCtx.stroke();
  });
}

function handleChartMouseMove(e) {
  const boundingRectangle = UI.optionsChart.getBoundingClientRect();
  const mouseX = e.clientX - boundingRectangle.left;
  const mouseY = e.clientY - boundingRectangle.top;
  let closestNode = null;
  let minimumProximityDistance = 15;
  plottedCoordinatesCache.forEach(pt => {
    const distance = Math.sqrt((mouseX - pt.x) ** 2 + (mouseY - pt.y) ** 2);
    if (distance < minimumProximityDistance) {
      minimumProximityDistance = distance;
      closestNode = pt;
    }
  });
  if (closestNode) {
    if (!hoverStateNode || hoverStateNode.x !== closestNode.x) {
      hoverStateNode = closestNode;
      renderTimelinePerformanceChart(getFilteredTelemetry());
    }
    const log = closestNode.data;
    const timeStr = new Date(log.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    UI.chartTooltip.innerHTML = `<div style="font-weight:bold; margin-bottom:4px; color:#ffffff;">${timeStr}</div><div><b>Avg SNR:</b> ${log.avgSNR.toFixed(2)} dB</div><div><b>Min SNR:</b> ${log.minSNR.toFixed(1)} dB</div><div><b>Correctables:</b> ${log.totalCorrectables.toLocaleString()}</div><div style="color:${log.totalUncorrectables > 0 ? '#ef4444' : 'inherit'}"><b>Uncorrectables:</b> ${log.totalUncorrectables.toLocaleString()}</div>`;
    UI.chartTooltip.style.display = 'block';
    UI.chartTooltip.style.left = `${closestNode.x + 15}px`;
    UI.chartTooltip.style.top = `${closestNode.y - 45}px`;
  } else if (hoverStateNode) {
    hoverStateNode = null;
    UI.chartTooltip.style.display = 'none';
    renderTimelinePerformanceChart(getFilteredTelemetry());
  }
}

// --- DYNAMIC PIE CHART ENGINE FILTERED BY UNCORRECTABLES ---
/**
 * Renders the Pie Chart with dynamic color-coding based on global error averages.
 * Red = Above Average (Significant), Green = Below/At Average (Baseline/Noise).
 * @param {Array} dataset - The filtered telemetry data to visualize.
 * @param {number} avgErrors - The calculated global average error count for thresholding.
 */
function renderBoundaryDistributionPieChart(dataset, avgErrors) {
  const canvasCtx = UI.pieChart.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = UI.pieChart.parentElement.clientWidth || 250;
  const palette = getActiveThemePalette();

  UI.pieChart.width = w * dpr;
  UI.pieChart.height = 180 * dpr;
  UI.pieChart.style.width = `${w}px`;
  UI.pieChart.style.height = `180px`;
  canvasCtx.scale(dpr, dpr);
  canvasCtx.clearRect(0, 0, w, 180);

  plottedPieSlicesCache = [];

  // Filter only samples that have uncorrectable errors
  const validPieSamples = dataset.filter(log => (log.totalUncorrectables || 0) > 0);

  if (validPieSamples.length === 0) {
    canvasCtx.fillStyle = palette.text;
    canvasCtx.font = "11px sans-serif";
    canvasCtx.textAlign = "center";
    canvasCtx.fillText("No uncorrectable errors logged.", w / 2, 90);
    return;
  }

  const grandTotalUncorrectables = validPieSamples.reduce((acc, log) => acc + (log.totalUncorrectables || 0), 0);
  let currentAngle = -Math.PI / 2;
  const cX = w / 2, cY = 90, baseRadius = 60;

  validPieSamples.forEach((log) => {
    const sliceAngle = (log.totalUncorrectables / grandTotalUncorrectables) * (Math.PI * 2);
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const isHovered = hoveredPieSlice && hoveredPieSlice.capturedAt === log.capturedAt;

    // Logic: Red if strictly greater than avgErrors (Significant Incident),
    // Otherwise Green (Baseline Noise)
    const isAboveAverage = log.totalUncorrectables > avgErrors;
    const segmentColor = isAboveAverage ? "#dc2626" : "#22c55e";

    canvasCtx.beginPath();
    canvasCtx.moveTo(cX, cY);
    canvasCtx.arc(cX, cY, isHovered ? baseRadius + 8 : baseRadius, startAngle, endAngle);
    canvasCtx.closePath();
    canvasCtx.fillStyle = segmentColor;
    canvasCtx.fill();
    canvasCtx.strokeStyle = palette.pointStroke;
    canvasCtx.lineWidth = 1.5;
    canvasCtx.stroke();

    plottedPieSlicesCache.push({
      capturedAt: log.capturedAt,
      timeLabel: new Date(log.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      uncorrectables: log.totalUncorrectables,
      percentage: (log.totalUncorrectables / grandTotalUncorrectables) * 100,
      startAngle, endAngle, segmentColor
    });
    currentAngle = endAngle;
  });
}
function handlePieMouseMove(e) {
  const boundingRectangle = UI.pieChart.getBoundingClientRect();
  const mouseX = e.clientX - boundingRectangle.left;
  const mouseY = e.clientY - boundingRectangle.top;
  const cX = boundingRectangle.width / 2, cY = 90;
  const deltaX = mouseX - cX, deltaY = mouseY - cY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  let mouseAngle = Math.atan2(deltaY, deltaX);
  if (mouseAngle < -Math.PI / 2) mouseAngle += Math.PI * 2;
  let matchNode = null;
  if (distance <= 75 && distance > 5) {
    plottedPieSlicesCache.forEach(slice => {
      if (mouseAngle > slice.startAngle && mouseAngle <= slice.endAngle) matchNode = slice;
    });
  }
  if (matchNode) {
    if (!hoveredPieSlice || hoveredPieSlice.capturedAt !== matchNode.capturedAt) {
      hoveredPieSlice = matchNode;
      renderBoundaryDistributionPieChart(getFilteredTelemetry());
    }
    UI.pieTooltip.innerHTML = `<div style="font-weight:bold; color:#ffffff;">Snapshot ${matchNode.timeLabel}</div><div><b>Uncorrectables:</b> ${matchNode.uncorrectables.toLocaleString()}</div><div style="font-size:10px;">Share: ${matchNode.percentage.toFixed(1)}%</div>`;
    UI.pieTooltip.style.display = 'block';
    UI.pieTooltip.style.left = `${mouseX + 15}px`;
    UI.pieTooltip.style.top = `${mouseY - 25}px`;
  } else if (hoveredPieSlice) {
    hoveredPieSlice = null;
    UI.pieTooltip.style.display = 'none';
    renderBoundaryDistributionPieChart(getFilteredTelemetry());
  }
}
 // 6. Donation Overlay Windows Controller
  const donateModal = document.getElementById('donateModal');
  const openDonateBtn = document.getElementById('openDonateModalBtn');
  const closeDonateBtn = document.getElementById('closeDonateModalBtn');
  const copyBtcBtn = document.getElementById('copyBtcBtn');
  const copyEthBtn = document.getElementById('copyEthBtn');

  if (openDonateBtn && donateModal) openDonateBtn.addEventListener('click', () => donateModal.style.display = 'flex');
  if (closeDonateBtn && donateModal) closeDonateBtn.addEventListener('click', () => donateModal.style.display = 'none');

  // Bitcoin Clipboards Pipeline
  if (copyBtcBtn) {
    copyBtcBtn.addEventListener('click', () => {
      const btcTarget = document.getElementById('btcAddress');
      if (btcTarget) {
        btcTarget.select();
        navigator.clipboard.writeText(btcTarget.value);
        copyBtcBtn.innerText = "Copied!";
        copyBtcBtn.style.background = "#10b981";
        setTimeout(() => {
          copyBtcBtn.innerText = "Copy";
          copyBtcBtn.style.background = ""; // Falls back to CSS variables
        }, 2000);
      }
    });
  }

  // Ethereum Clipboards Pipeline
  if (copyEthBtn) {
    copyEthBtn.addEventListener('click', () => {
      const ethTarget = document.getElementById('ethAddress');
      if (ethTarget) {
        ethTarget.select();
        navigator.clipboard.writeText(ethTarget.value);
        copyEthBtn.innerText = "Copied!";
        copyEthBtn.style.background = "#10b981";
        setTimeout(() => {
          copyEthBtn.innerText = "Copy";
          copyEthBtn.style.background = ""; // Falls back to CSS variables
        }, 2000);
      }
    });
  }

if (quickSampleBtn) {
      quickSampleBtn.addEventListener('click', () => {
        quickSampleBtn.innerText = "Scanning...";
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