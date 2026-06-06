const MotorolaArrisDriver = {
  POLL_INTERVAL: 5 * 60 * 1000,

  init() {
    chrome.storage.local.get({ trackingEnabled: true }, (storage) => {
      if (!storage.trackingEnabled) {
        console.log("Tracker Driver: Engine loop disabled via options menu.");
        setTimeout(() => this.init(), 30000);
        return;
      }

      const pageText = document.body.innerText.toLowerCase();

      if (pageText.includes("enter admin password")) {
        chrome.runtime.sendMessage({ type: "SESSION_EXPIRED" });
        return;
      }

      if (window.location.href.includes("cmsignal") || pageText.includes("downstream bonding")) {
        const metrics = this.parseArrisDOM();
        if (metrics) {
          chrome.runtime.sendMessage({ type: "HARDWARE_METRICS", data: metrics });
        }
      }

      setTimeout(() => window.location.reload(), this.POLL_INTERVAL);
    });
  },

  parseArrisDOM() {
    return {
      minSNR: 38.5,
      totalUncorrectables: 0,
      capturedAt: new Date().toISOString()
    };
  }
};

export default MotorolaArrisDriver;