# Universal Node Congestion Tracker

A lightweight, privacy-first Google Chrome Extension (Manifest V3) designed to automatically log, process, and chart cable modem diagnostic telemetry. By monitoring physical layer RF (Radio Frequency) stability over time, this tool helps users document local network node congestion, line noise degradation, and packet drops without sending data outside their local machine.

---

##  Key Features

* **Automated Telemetry Ingestion:** Automatically crawls downstream bonding channel metrics every 5 minutes when an administrative modem page is left open in a background browser tab.
* **Plug-and-Play Driver Registry:** Highly modular parsing architecture. Support for new hardware profiles can be added by dropping a standalone driver script into the `modems/` directory and registering it.
* **Dynamic Hardware Routing:** Seamlessly maps targeted scraping profiles to specific tabs using layout keyword inspection and local IP signatures.
* **Interactive Diagnostic Control Center:** Renders responsive HTML5 Canvas timeline line graphs (with proximity hover tooltips) and overall health-distribution pie charts.
* **Native State Management:** Monitors active tracking states in the background and shifts the extension toolbar icon dynamically between a vivid active profile and a muted grey inactive profile.
* **Data Portability:** Full support for backing up, merging, or restoring historical telemetry timelines using standard `.csv` file imports and exports.
* **Zero-Telemetry Infrastructure:** Operations are 100% self-hosted. All logs are committed directly to the browser's sandboxed `chrome.storage.local` memory database.
* **Import/Export Support:** Support importation and exporting logs to send to your provider 
* **Theme Support**
---

## 📂 Project Directory Structure

```text
universal-node-tracker/
├── manifest.json         # Extension application manifests & permission definitions
├── background.js        # Service worker managing state observers and toolbar icons
├── content_router.js    # Decodes page signatures to inject matching modem drivers
├── options.html         # Diagnostic dashboard UI markup
├── options.js           # Analytics core (Canvas plotting, tooltips, CSV engine)
├── popup.html           # Toolbar popup panel layout
├── popup.js             # Handles quick-toggle execution bindings
├── PRIVACY.md           # Zero-Data Collection privacy documentation
├── icon-16.png          # Active state toolbar icon (16x16 standard screens)
├── icon-32.png          # Active state toolbar icon (32x32 Retina screens)
├── icon-16-off.png      # Muted disabled state toolbar icon (16x16)
├── icon-32-off.png      # Muted disabled state toolbar icon (32x32)
├── icon-128.png         # High-resolution Google Chrome Web Store asset profile
└── modems/              # Modular hardware scrapers sandbox
    ├── registry.js       # Central inventory mapping directory database
    ├── arris_surfboard.js# Parsing logic for Arris S33, S34, and SB8200 matrix models
    ├── isp_technicolor.js# Parsing logic for leased gateways (Comcast XB7/XB8 series)
    └── Netgear_cm2000.js # Parsing logic for Netgear Nighthawk multi-gig series