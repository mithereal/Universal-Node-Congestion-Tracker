// content_router.js
(async function routeToModemDriver() {
  // Dynamic import of the registry layout database
  const registryUrl = chrome.runtime.getURL('modems/registry.js');
  const { ModemRegistry } = await import(registryUrl);

  chrome.storage.local.get({ preferredModemProfile: 'auto' }, async (storage) => {
    let profile = storage.preferredModemProfile;
    let targetDriver = null;

    if (profile === 'auto') {
      const pageText = document.body.innerText.toLowerCase();
      const currentURL = window.location.href;

      // Automatic profile detection via registry inspection loops
      targetDriver = ModemRegistry.find(modem => {
        // Evaluate default IP mapping matches or raw string keywords
        const keywords = modem.id.split('_');
        const matchKeyword = keywords.some(kw => pageText.includes(kw));
        const matchIP = currentURL.includes(modem.defaultIP);
        return matchIP || matchKeyword;
      });
    } else {
      // Find the manually selected profile matching the registry ID
      targetDriver = ModemRegistry.find(modem => modem.id === profile);
    }

    if (!targetDriver) {
      console.log("Universal Tracker: Could not auto-detect configuration signature across active registry endpoints.");
      return;
    }

    try {
      const moduleUrl = chrome.runtime.getURL(targetDriver.driverPath);
      const modemModule = await import(moduleUrl);

      if (modemModule.default && typeof modemModule.default.init === 'function') {
        console.log(`Universal Tracker: Activating dynamic driver module [${targetDriver.name}]`);
        modemModule.default.init();
      }
    } catch (err) {
      console.error(`Tracker Router Error: Failed to spawn dynamic module instance at ${targetDriver.driverPath}:`, err);
    }
  });
})();