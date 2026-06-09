// modems/cox_technicolor.js
const CoxTechnicolorDriver = {
  POLL_INTERVAL: 5 * 60 * 1000,

  init() {
    const checkInterval = setInterval(() => {
      // Look for the specific data table structure in your source
      if (document.querySelector("table.data") || document.readyState === 'complete') {
        clearInterval(checkInterval);
        this.startEngine();
      }
    }, 500);
  },

  startEngine() {
    chrome.storage.local.get({ extensionEnabled: true }, (storage) => {
      if (!storage.extensionEnabled) return;

      console.log("Technicolor Driver: Scanning signal matrix...");

      if (document.querySelector("table.data")) {
        const metrics = this.parseTables();
        if (metrics) {
          chrome.runtime.sendMessage({ type: "HARDWARE_METRICS", data: metrics }).catch(() => {});
        }
      }
      setTimeout(() => window.location.reload(), this.POLL_INTERVAL);
    });
  },

  parseTables() {
    const rows = document.querySelectorAll("table.data tr");

    // Initialize objects
    let snrValues = [];
    let totalUnerrored = 0;
    let totalCorrectables = 0;
    let totalUncorrectables = 0;

    rows.forEach(row => {
      const th = row.querySelector("th.row-label");
      if (!th) return;

      const label = th.innerText.toLowerCase().trim();
      const cells = Array.from(row.querySelectorAll("td div.netWidth"));

      // 1. SNR Parsing
      if (label === "snr") {
        cells.forEach(cell => {
          const num = parseFloat(cell.innerText.replace(/[^\d.]/g, ''));
          if (!isNaN(num) && num > 10 && num < 60) snrValues.push(num);
        });
      }

      // 2. Unerrored Codewords
      if (label === "unerrored codewords") {
        cells.forEach(cell => {
          const val = parseInt(cell.innerText.replace(/,/g, ''), 10);
          if (!isNaN(val)) totalUnerrored += val;
        });
      }

      // 3. Correctable Codewords
      if (label === "correctable codewords") {
        cells.forEach(cell => {
          const val = parseInt(cell.innerText.replace(/,/g, ''), 10);
          if (!isNaN(val)) totalCorrectables += val;
        });
      }

      // 4. Uncorrectable Codewords
      if (label === "uncorrectable codewords") {
        cells.forEach(cell => {
          const val = parseInt(cell.innerText.replace(/,/g, ''), 10);
          if (!isNaN(val)) totalUncorrectables += val;
        });
      }
    });

    if (snrValues.length === 0) return null;

    return {
      capturedAt: Date.now(),
      channelsScanned: snrValues.length,
      minSNR: Math.min(...snrValues),
      avgSNR: parseFloat((snrValues.reduce((a, b) => a + b, 0) / snrValues.length).toFixed(2)),
      totalUnerrored: totalUnerrored,
      totalCorrectables: totalCorrectables,
      totalUncorrectables: totalUncorrectables
    };
  }
};

export default CoxTechnicolorDriver;