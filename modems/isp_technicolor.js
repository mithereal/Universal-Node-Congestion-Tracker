// modems/isp_technicolor.js

const ISPTechnicolorDriver = {
  POLL_INTERVAL: 5 * 60 * 1000,

  init() {
    chrome.storage.local.get({ trackingEnabled: true }, (storage) => {
      if (!storage.trackingEnabled) return;

      const pageText = document.body.innerText.toLowerCase();
      const currentURL = window.location.href;

      // Gateway pages usually require user auth. Redirect trigger if bounced to entry screen.
      if (pageText.includes("sign in") && currentURL.includes("login.php")) {
        chrome.runtime.sendMessage({ type: "SESSION_EXPIRED" });
        return;
      }

      // Typically matching route structure strings: /connection_docsis.php or /at_a_glance.php
      if (currentURL.includes("docsis") || pageText.includes("downstream signal")) {
        const metrics = this.parseGatewayDOM();
        if (metrics) {
          chrome.runtime.sendMessage({ type: "HARDWARE_METRICS", data: metrics });
        }
      }

      setTimeout(() => window.location.reload(), this.POLL_INTERVAL);
    });
  },

  parseGatewayDOM() {
    // ISP Gateway portals rely extensively on data tables with predictable ID selectors
    const downstreamTable = document.getElementById("downstream_table") || document.querySelector(".data-table");
    if (!downstreamTable) return null;

    let snrValues = [];
    let uncorrectableErrors = 0;

    const rows = downstreamTable.querySelectorAll("tr");
    rows.forEach(row => {
      const cells = Array.from(row.querySelectorAll("td")).map(c => c.innerText.trim());
      if (cells.length < 5) return;

      // Standard Technicolor Matrix Shape layout mapping:
      // [ Index, Frequency, Power, SNR, Codewords, Uncorrectables ]
      // We look explicitly for cells containing a decimal format for SNR and parse integers for errors.
      cells.forEach(cell => {
        if (cell.includes("dB") && !cell.includes("dBmV")) {
          const snr = parseFloat(cell.replace(/[^0-9.]/g, ''));
          if (!isNaN(snr) && snr > 10) snrValues.push(snr);
        }
      });

      // Target last index columns where uncorrectables track line drops
      const potentialUncorrectable = cells[cells.length - 1];
      if (potentialUncorrectable && /^\d+$/.test(potentialUncorrectable.replace(/[^0-9]/g, ''))) {
        const errVal = parseInt(potentialUncorrectable.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(errVal)) {
          uncorrectableErrors += errVal;
        }
      }
    });

    if (snrValues.length === 0) return null;

    return {
      minSNR: Math.min(...snrValues),
      totalUncorrectables: uncorrectableErrors,
      capturedAt: new Date().toISOString()
    };
  }
};

export default ISPTechnicolorDriver;