const CoxTechnicolorDriver = {
  DEFAULT_POLL: 5 * 60 * 1000,

  init() {
    const checkInterval = setInterval(() => {
      if (document.querySelector("table.data") || document.readyState === 'complete') {
        clearInterval(checkInterval);
        this.startEngine();
      }
    }, 500);
  },

  startEngine() {
    chrome.storage.local.get({ extensionEnabled: true, pollingInterval: 5 }, (storage) => {
      if (!storage.extensionEnabled) return;

      console.log("Technicolor Driver: Scanning signal matrix...");

      if (document.querySelector("table.data")) {
        const channelMetrics = this.parseChannels();

        if (channelMetrics && channelMetrics.channels.length > 0) {
          // 1. Send Granular Channel Data
          chrome.runtime.sendMessage({ type: "CHANNEL_DATA", data: channelMetrics }).catch(() => {});

          // 2. Calculate and send Summary Metrics under correct message mapping identifier
          const totalErrors = channelMetrics.channels.reduce((sum, ch) => sum + ch.uncorrectable, 0);
          const totalSNR = channelMetrics.channels.reduce((sum, ch) => sum + ch.snr, 0);
          const avgSNR = totalSNR / channelMetrics.channels.length;

          const summaryMetrics = {
            capturedAt: channelMetrics.capturedAt,
            avgSNR: parseFloat(avgSNR.toFixed(2)),
            minSNR: Math.min(...channelMetrics.channels.map(ch => ch.snr)),
            totalUncorrectables: totalErrors,
            channelsScanned: channelMetrics.channels.length
          };

          chrome.runtime.sendMessage({ type: "HARDWARE_METRICS", data: summaryMetrics }).catch(() => {});
        }
      }

      const intervalMs = (storage.pollingInterval * 60 * 1000) || this.DEFAULT_POLL;
      setTimeout(() => window.location.reload(), intervalMs);
    });
  },

  parseChannels() {
    const rows = document.querySelectorAll("table.data tr");
    const channels = [];

    const findRow = (label) => Array.from(rows).find(r =>
      r.querySelector("th.row-label")?.innerText.toLowerCase().includes(label)
    );

    const getCells = (row) => row ? Array.from(row.querySelectorAll("td div.netWidth")) : [];

    const snrRow = findRow("snr");
    const unerroredRow = findRow("unerrored codewords");
    const correctableRow = findRow("correctable codewords");
    const uncorrectableRow = findRow("uncorrectable codewords");

    const snrCells = getCells(snrRow);

    snrCells.forEach((_, i) => {
      channels.push({
        channelId: i + 1,
        snr: parseFloat(getCells(snrRow)[i]?.innerText.replace(/[^\d.]/g, '')) || 0,
        unerrored: parseInt(getCells(unerroredRow)[i]?.innerText.replace(/,/g, ''), 10) || 0,
        correctable: parseInt(getCells(correctableRow)[i]?.innerText.replace(/,/g, ''), 10) || 0,
        uncorrectable: parseInt(getCells(uncorrectableRow)[i]?.innerText.replace(/,/g, ''), 10) || 0
      });
    });

    return {
      capturedAt: Date.now(),
      channels: channels
    };
  }
};

export default CoxTechnicolorDriver;