import { ModemRegistry } from './modems/registry.js';

let groupedLogs = {};
let activeDateKey = null;
let activePointData = []; // Stores chart coordinates for tooltip collisions

document.addEventListener('DOMContentLoaded', () => {
  // 1. Storage Processing & Initial Layout Render
  loadAndRenderData();

  // Listen for real-time browser theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    // Force canvas systems to repaint using updated color boundaries
    loadAndRenderData();
  });

  // 2. Build out plug-and-play selection choices from dynamic registry
  buildDynamicModemDropdown();

  // 2b. Sync Polling Interval Menu Pipeline
  setupIntervalDropdown();

  // 3. Register CSV upload listeners
  const fileInput = document.getElementById('csvFileInput');
  if (fileInput) fileInput.addEventListener('change', handleCSVImport);

  // 4. Register CSV export listener
  const exportBtn = document.getElementById('csvExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', handleCSVExport);

  // 5. Hover Tooltip Intersect Observers
  const mainCanvas = document.getElementById('optionsChart');
  if (mainCanvas) {
    mainCanvas.addEventListener('mousemove', handleChartHover);
    mainCanvas.addEventListener('mouseleave', () => {
      const tooltip = document.getElementById('chartTooltip');
      if (tooltip) tooltip.style.display = 'none';
    });
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

  // 7. Listen for state updates coming from popup toggle switches
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE_CHANGED') {
      loadAndRenderData();
    }
  });
});

// --- TIMING INTERVAL DROPDOWN REGISTRY PIPELINE ---
function setupIntervalDropdown() {
  const intervalSelect = document.getElementById('pollingIntervalSelect');
  if (!intervalSelect) return;

  // Hydrate UI state selection from local storage
  chrome.storage.local.get({ pollingIntervalMinutes: 5 }, (data) => {
    intervalSelect.value = data.pollingIntervalMinutes.toString();
  });

  // Watch for adjustments to trigger interval changes across elements
  intervalSelect.addEventListener('change', (e) => {
    const minutes = parseInt(e.target.value, 10);

    chrome.storage.local.set({ pollingIntervalMinutes: minutes }, () => {
      // Re-initialize chrome.alarms schedule stack directly
      chrome.alarms.clear('telemetry_poll_alarm', () => {
        chrome.alarms.create('telemetry_poll_alarm', {
          periodInMinutes: minutes,
          delayInMinutes: minutes
        });
      });
    });
  });
}

// --- DYNAMIC REGISTRY INTERFACE LOOP ---
function buildDynamicModemDropdown() {
  const profileSelect = document.getElementById('modemProfileSelect');
  if (!profileSelect) return;

  // Flush hardcoded configurations except default fallback anchor
  profileSelect.innerHTML = '<option value="auto">Auto-Detect Brand</option>';

  // Append registered modem objects instantly on tab creation
  ModemRegistry.forEach(modem => {
    const opt = document.createElement('option');
    opt.value = modem.id;
    opt.innerText = modem.name;
    profileSelect.appendChild(opt);
  });

  // Rehydrate previous state choices
  chrome.storage.local.get({ preferredModemProfile: 'auto' }, (data) => {
    profileSelect.value = data.preferredModemProfile;
  });

  profileSelect.addEventListener('change', (e) => {
    chrome.storage.local.set({ preferredModemProfile: e.target.value });
  });
}

function loadAndRenderData() {
  chrome.storage.local.get({
    networkLogs: [],
    extensionEnabled: true
  }, (storage) => {
    // Process history unconditionally so logs remain browsable even when tracking is suspended
    processDataArray(storage.networkLogs);
  });
}

function processDataArray(rawLogs) {
  groupedLogs = {};
  if (!rawLogs || rawLogs.length === 0) {
    renderEmptyState();
    return;
  }
  rawLogs.forEach(entry => {
    if (!entry.timestamp) return;
    const dateKey = entry.timestamp.split('T')[0];
    if (!groupedLogs[dateKey]) groupedLogs[dateKey] = [];
    groupedLogs[dateKey].push(entry);
  });
  buildDateTabs();
}

function buildDateTabs() {
  const tabsContainer = document.getElementById('tabsContainer');
  if (!tabsContainer) return;
  tabsContainer.innerHTML = '';
  const dates = Object.keys(groupedLogs).sort();

  if (dates.length === 0) return;
  if (!activeDateKey || !groupedLogs[activeDateKey]) {
    activeDateKey = dates[dates.length - 1];
  }

  dates.forEach(dateStr => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${dateStr === activeDateKey ? 'active' : ''}`;
    const pieces = dateStr.split('-');
    btn.innerText = pieces.length === 3 ? `${pieces[1]}/${pieces[2]}` : dateStr;
    btn.addEventListener('click', () => {
      activeDateKey = dateStr;
      buildDateTabs();
    });
    tabsContainer.appendChild(btn);
  });

  drawDailyGraph(groupedLogs[activeDateKey]);
  drawPieChart(groupedLogs[activeDateKey]);
}

function drawDailyGraph(dayLogs) {
  const canvas = document.getElementById('optionsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Adjust visualization variables dynamically by theme profile
  const mainGridColor  = isDarkMode ? '#334155' : '#e2e8f0';
  const subGridColor   = isDarkMode ? '#1e293b' : '#f1f5f9';
  const textLabelColor = isDarkMode ? '#94a3b8' : '#64748b';
  const trendLineColor = isDarkMode ? '#38bdf8' : '#3b82f6';
  const nodeDotColor   = isDarkMode ? '#0ea5e9' : '#1d4ed8';

  canvas.width = 650;
  canvas.height = 280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!dayLogs || dayLogs.length === 0) return;

  const totalPoints = dayLogs.length;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;

  const graphWidth = canvas.width - paddingLeft - paddingRight;
  const graphHeight = canvas.height - paddingTop - paddingBottom;
  const spacing = graphWidth / (totalPoints > 1 ? totalPoints - 1 : 1);

  activePointData = [];

  // Draw Y Axis Decibel Gridlines
  ctx.strokeStyle = mainGridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = textLabelColor;
  ctx.font = '10px sans-serif';

  const snrLevels = [20, 25, 30, 35, 40, 45];
  snrLevels.forEach(level => {
    const y = paddingTop + graphHeight - ((level - 20) * (graphHeight / 25));
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(canvas.width - paddingRight, y);
    ctx.stroke();
    ctx.fillText(`${level} dB`, 5, y + 3);
  });

  // Calculate plotting tracks and draw X Time Grids
  const maxTimeLabels = 5;
  const step = Math.ceil(totalPoints / maxTimeLabels);

  dayLogs.forEach((log, i) => {
    const x = paddingLeft + (i * spacing);
    const yLine = paddingTop + graphHeight - ((log.minSNR - 20) * (graphHeight / 25));
    activePointData.push({ x: x, y: yLine, raw: log });

    if (i % step === 0 || i === totalPoints - 1) {
      ctx.strokeStyle = subGridColor;
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, canvas.height - paddingBottom);
      ctx.stroke();

      ctx.fillStyle = textLabelColor;
      const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      ctx.fillText(timeStr, x - 18, canvas.height - 12);
    }
  });

  // Stroke Path Curve
  ctx.strokeStyle = trendLineColor;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  activePointData.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.stroke();

  // Dots
  activePointData.forEach(pt => {
    ctx.fillStyle = nodeDotColor;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
    ctx.fill();
  });

  let minSNR = Math.min(...dayLogs.map(l => l.minSNR));
  let totalErrors = dayLogs.reduce((acc, curr) => acc + (curr.uncorrectables || 0), 0);
  document.getElementById('statMinSNR').innerText = `${minSNR.toFixed(1)} dB`;
  document.getElementById('statErrors').innerText = totalErrors.toLocaleString();
  document.getElementById('statSamples').innerText = totalPoints;
}

function handleChartHover(event) {
  const canvas = document.getElementById('optionsChart');
  const rect = canvas.getBoundingClientRect();
  const tooltip = document.getElementById('chartTooltip');
  if (!canvas || !tooltip || activePointData.length === 0) return;

  const mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
  let closestPoint = activePointData.reduce((prev, curr) => {
    return (Math.abs(curr.x - mouseX) < Math.abs(prev.x - mouseX)) ? curr : prev;
  });

  if (Math.abs(closestPoint.x - mouseX) < 20) {
    const time = new Date(closestPoint.raw.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    tooltip.style.display = 'block';
    tooltip.innerHTML = `
      <b>Time:</b> ${time}<br/>
      <b>Worst SNR:</b> <span style="color:var(--tab-active, #3b82f6); font-weight:bold;">${closestPoint.raw.minSNR.toFixed(1)} dB</span><br/>
      <b>Codewords:</b> ${closestPoint.raw.uncorrectables.toLocaleString()}
    `;
    tooltip.style.left = (closestPoint.x * (rect.width / canvas.width)) + 15 + 'px';
    tooltip.style.top = (closestPoint.y * (rect.height / canvas.height)) - 15 + 'px';
  } else {
    tooltip.style.display = 'none';
  }
}

function drawPieChart(dayLogs) {
  const canvas = document.getElementById('pieChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const textLabelColor = isDarkMode ? '#94a3b8' : '#334155';

  canvas.width = 300;
  canvas.height = 280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!dayLogs || dayLogs.length === 0) return;

  let categories = [
    { label: 'Pristine (>35dB)', count: 0, color: '#10b981' },
    { label: 'Degraded (30-35dB)', count: 0, color: '#f59e0b' },
    { label: 'Severe Noise (<30dB)', count: 0, color: '#ef4444' }
  ];

  dayLogs.forEach(log => {
    if (log.minSNR > 35) categories[0].count++;
    else if (log.minSNR >= 30) categories[1].count++;
    else categories[2].count++;
  });

  const totalSamples = dayLogs.length;
  let startAngle = 0;
  const centerX = 150;
  const centerY = 105;
  const radius = 70;

  categories.forEach(cat => {
    if (cat.count === 0) return;
    const sliceAngle = (cat.count / totalSamples) * (2 * Math.PI);
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();
    startAngle += sliceAngle;
  });

  ctx.font = '11px sans-serif';
  categories.forEach((cat, idx) => {
    const pct = ((cat.count / totalSamples) * 100).toFixed(1);
    const yPos = 210 + (idx * 20);
    ctx.fillStyle = cat.color;
    ctx.fillRect(25, yPos - 9, 12, 12);
    ctx.fillStyle = textLabelColor;
    ctx.fillText(`${cat.label}: ${cat.count} ticks (${pct}%)`, 45, yPos);
  });
}

function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split('\n');
    let importedLogs = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      if (row.length >= 3 && row[0].trim() !== "") {
        importedLogs.push({
          timestamp: row[0].trim(),
          minSNR: parseFloat(row[1]),
          uncorrectables: parseInt(row[2], 10)
        });
      }
    }

    if (importedLogs.length > 0) {
      chrome.storage.local.get({ networkLogs: [] }, (storage) => {
        const existingMap = new Set(storage.networkLogs.map(l => l.timestamp));
        const combined = [...storage.networkLogs];
        importedLogs.forEach(item => {
          if (!existingMap.has(item.timestamp)) combined.push(item);
        });
        chrome.storage.local.set({ networkLogs: combined }, () => {
          alert(`Success: Integrated ${importedLogs.length} frames.`);
          loadAndRenderData();
        });
      });
    }
  };
  reader.readAsText(file);
}

function handleCSVExport() {
  chrome.storage.local.get({ networkLogs: [] }, (storage) => {
    const logs = storage.networkLogs;

    if (!logs || logs.length === 0) {
      alert("No data available to export yet.");
      return;
    }

    // Sort chronologically before parsing output string payload
    logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Construct standard text schema header pipeline
    let csvContent = "Timestamp,Worst SNR (dB),Uncorrectable Codewords\n";

    logs.forEach(log => {
      const timestamp = log.timestamp || '';
      const minSNR = log.minSNR !== undefined ? log.minSNR : '';
      const uncorrectables = log.uncorrectables !== undefined ? log.uncorrectables : '';

      csvContent += `${timestamp},${minSNR},${uncorrectables}\n`;
    });

    // Generate blob tracking link context
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;

    const dateStamp = new Date().toISOString().split('T')[0];
    downloadLink.setAttribute("download", `node_congestion_logs_${dateStamp}.csv`);

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  });
}

function renderEmptyState() {
  const canvas = document.getElementById('optionsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  canvas.width = 650; canvas.height = 280;
  ctx.font = '14px sans-serif';
  ctx.fillStyle = isDarkMode ? '#64748b' : '#94a3b8';
  ctx.fillText('No history detected. Keep your modem diagnostics page active to compile timeline logs.', 50, 140);
}