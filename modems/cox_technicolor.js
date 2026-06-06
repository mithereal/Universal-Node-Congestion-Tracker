const CoxTechnicolorDriver = {
  POLL_INTERVAL: 5 * 60 * 1000,

  init() {
    chrome.storage.local.get({ trackingEnabled: true }, (storage) => {
      if (!storage.trackingEnabled) {
        console.log("Tracker Driver: Engine loop disabled via options menu.");
        setTimeout(() => this.init(), 30000);
        return;
      }

      const pageText = document.body.innerText.toLowerCase();
      const isLoginPage = pageText.includes("sign in") ||
                           (document.querySelector("input[type='password']") && !document.querySelector("#signal-table"));

      if (isLoginPage) {
        chrome.runtime.sendMessage({ type: "SESSION_EXPIRED" });
        return;
      }

      if (window.location.href.includes("signal") || pageText.includes("downstream")) {
        const metrics = this.parseTables();
        if (metrics) {
          chrome.runtime.sendMessage({ type: "HARDWARE_METRICS", data: metrics });
        }
      }

      setTimeout(() => window.location.reload(), this.POLL_INTERVAL);
    });
  },

  parseTables() {
    const rows = document.querySelectorAll("table tr");
    let snrValues = [];
    let uncorrectableErrors = 0;

    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      if (text.includes("snr") || text.includes("signal to noise")) {
        const cells = Array.from(row.querySelectorAll("td")).map(td => td.innerText.trim());
        cells.forEach(c => {
          const num = parseFloat(c);
          if (!isNaN(num)) snrValues.push(num);
        });
      }
      if (text.includes("uncorrectable") || text.includes("uncorrected")) {
        const cells = row.querySelectorAll("td");
        if (cells.length > 1) {
          const val = parseInt(cells[cells.length - 1].innerText.replace(/,/g, ''), 10);
          if (!isNaN(val)) uncorrectableErrors += val;
        }
      }
    });

    if (snrValues.length === 0 && uncorrectableErrors === 0) return null;

    return {
      minSNR: Math.min(...snrValues),
      totalUncorrectables: uncorrectableErrors,
      capturedAt: new Date().toISOString()
    };
  }
};

export default CoxTechnicolorDriver;