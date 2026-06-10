# Universal Node Congestion Tracker

A lightweight, privacy-first Google Chrome Extension (Manifest V3) designed to automatically log, process, and chart cable modem diagnostic telemetry. By monitoring physical layer RF (Radio Frequency) stability over time, this tool helps users document local network node congestion, line noise degradation, and packet drops without sending data outside their local machine.

---
### How to Use:
* log-in to the routers admin page
* click on connection -> cox network page or whatever similar page shows downstream
* leave the page open in the background
* ensure the extension is running by clicking the slider it will say extension running when active

cable modem requests:
if you would like your cable modem added open an issue, use the Cable Modem Request template.

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

Donations are Appreciated.
