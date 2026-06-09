// modems/registry.js

export const ModemRegistry = [
  {
    id: "cox_technicolor",
    name: "Cox / Technicolor (CGM4331COM)",
    driverPath: "modems/cox_technicolor.js",
    defaultIP: "192.168.0.1"
  }
  // To add a new modem, you only drop the file in and add one row here:
  // ,{ id: "netgear_cm", name: "Netgear Nighthawk", driverPath: "modems/netgear_cm.js", defaultIP: "192.168.1.1" }
];