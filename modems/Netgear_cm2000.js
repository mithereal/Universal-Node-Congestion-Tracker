// modems/Netgear_cm2000.js

const NetgearCM2000Driver = {
  POLL_INTERVAL: 5 * 60 * 1000, // 5-minute interval sync loop

  init() {
    chrome.storage.local.get({ trackingEnabled: true }, (storage) => {
      if (!storage.trackingEnabled) {
        console.log("Netgear CM2000 Driver: Tracking engine is currently turned off.");
        setTimeout(() => this.init(), 30000); // Re-check state configuration in 30s
        return;
      }

      const pageText = document.body.innerText.toLowerCase();
      const currentURL = window.location.href;

      // 1. Session Expiry Check
      // Netgear modems usually redirect to a login screen or throw a 401/Basic Auth prompt if locked down.
      if (pageText.includes("login") || pageText.includes("enter admin password")) {
        chrome.runtime.sendMessage({ type: "SESSION_EXPIRED" });
        return;
      }

      // 2. Route Check
      // This matches both the default Netgear status endpoints and text headers found on the page
      if (currentURL.includes("DocsisStatus") || pageText.includes("downstream bonded channels")) {
        const metrics = this.parseNetgearDOM();
        if (metrics) {
          chrome.runtime.sendMessage({ type: "HARDWARE_METRICS", data: metrics });
        }
      }

      // 3. Keep-Alive Refresh Loop
      setTimeout(() => window.location.reload(), this.POLL_INTERVAL);
    });
  },

  parseNetgearDOM() {
    // Netgear status pages arrange data inside standard tables with clean text definitions
    const tables = document.querySelectorAll("table");
    let snrValues = [];
    let uncorrectableErrors = 0;
    let foundDownstreamTable = false;

    for (let table of tables) {
      const headerText = table.innerText.toLowerCase();

      // Isolate the Downstream Bonded Channels grid array
      if (headerText.includes("downstream") && (headerText.includes("snr") || headerText.includes("signal to noise"))) {
        foundDownstreamTable = true;
        const rows = table.querySelectorAll("tr");

        rows.forEach(row => {
          const cells = Array.from(row.querySelectorAll("td, th")).map(c => c.innerText.trim());
          if (cells.length < 3) return;

          // Netgear layouts typically group entries vertically or horizontally by column headings
          cells.forEach(cell => {
            // Clean up text characters like " dB" or " dBmV" to pull pure floats
            if (cell.includes("dB") && !cell.includes("dBmV")) {
              const cleanedSNR = parseFloat(cell.replace(/[^0-9.]/g, ''));
              if (!isNaN(cleanedSNR) && cleanedSNR > 0) {
                snrValues.push(cleanedSNR);
              }
            }
          });
        });

        // Parse corresponding Error Counters (Uncorrectable Codewords)
        rows.forEach(row => {
          const rowText = row.innerText.toLowerCase();
          if (rowText.includes("uncorrectables") || rowText.includes("uncorrected")) {
            const cells = row.querySelectorAll("td");
            cells.forEach(cell => {
              const val = parseInt(cell.innerText.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(val)) {
                uncorrectableErrors += val;
              }
            });
          }
        });
      }
    }

    // If the parser hits a completely generic or unauthenticated landing window, fall back safely
    if (!foundDownstreamTable || snrValues.length === 0) {
      console.log("Netgear CM2000 Driver: Found status route, but downstream metrics matrix was unreadable.");
      return null;
    }

    return {
      minSNR: Math.min(...snrValues),
      totalUncorrectables: uncorrectableErrors,
      capturedAt: new Date().toISOString()
    };
  }
};

export default NetgearCM2000Driver;