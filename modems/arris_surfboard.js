// modems/arris_surfboard.js

const ArrisSurfboardDriver = {
  POLL_INTERVAL: 5 * 60 * 1000,

  init() {
    chrome.storage.local.get({ trackingEnabled: true }, (storage) => {
      if (!storage.trackingEnabled) {
        console.log("Arris Surfboard Driver: Monitoring suspended.");
        setTimeout(() => this.init(), 30000);
        return;
      }

      const pageText = document.body.innerText.toLowerCase();

      // Arris tables typically use explicit "Downstream Bonded Channels" string targets
      if (pageText.includes("downstream bonded channels") || pageText.includes("snr/mer")) {
        const metrics = this.parseArrisDOM();
        if (metrics) {
          chrome.runtime.sendMessage({ type: "HARDWARE_METRICS", data: metrics });
        }
      }

      setTimeout(() => window.location.reload(), this.POLL_INTERVAL);
    });
  },

  parseArrisDOM() {
    const tables = document.querySelectorAll("table");
    let snrValues = [];
    let uncorrectableErrors = 0;
    let foundTable = false;

    for (let table of tables) {
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length === 0) continue;

      const fullTableText = table.innerText.toLowerCase();

      // Target the exact Downstream diagnostic table rows matrix
      if (fullTableText.includes("snr") || fullTableText.includes("uncorrectable")) {
        foundTable = true;

        // Arris can sort parameters horizontally in rows OR vertically in columns depending on firmware tier.
        // We evaluate every column slice cell natively for clear pattern strings.
        rows.forEach(row => {
          const cells = Array.from(row.querySelectorAll("td, th")).map(c => c.innerText.trim().toLowerCase());

          cells.forEach((cell, idx) => {
            // 1. Capture SNR Value Blocks (Expected format: "38.5 dB" or pure float)
            if (cell.includes("db") && !cell.includes("dbmv")) {
              const val = parseFloat(cell.replace(/[^0-9.]/g, ''));
              if (!isNaN(val) && val > 0) snrValues.push(val);
            }
          });

          // 2. Identify explicit error metrics rows mapping
          const rowHead = cells[0] || "";
          if (rowHead.includes("uncorrectable") || rowHead.includes("unered codewords")) {
            cells.forEach((cell, idx) => {
              if (idx === 0) return; // Skip title heading row cell
              const count = parseInt(cell.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(count)) {
                uncorrectableErrors += count;
              }
            });
          }
        });
      }
    }

    if (!foundTable || snrValues.length === 0) {
      console.log("Arris Surfboard Driver: Targeted structural table attributes missing.");
      return null;
    }

    return {
      minSNR: Math.min(...snrValues),
      totalUncorrectables: uncorrectableErrors,
      capturedAt: new Date().toISOString()
    };
  }
};

export default ArrisSurfboardDriver;