// modems/registry.js

export const ModemRegistry = [
{
    id: "arris_surfboard",
    name: "Arris SURFboard (S33/S34/SB8200)",
    driverPath: "modems/arris_surfboard.js",
    defaultIP: "192.168.100.1"
  },
     {
       id: "isp_technicolor",
       name: "ISP Gateway (Technicolor/Comcast XB7/XB8)",
       driverPath: "modems/isp_technicolor.js",
       defaultIP: "192.168.0.1"
     },
  {
    id: "cox_technicolor",
    name: "Cox / Technicolor (CGM4331COM)",
    driverPath: "modems/cox_technicolor.js",
    defaultIP: "192.168.0.1"
  },
  {
    id: "motorola_arris",
    name: "Motorola / Arris Surfboard",
    driverPath: "modems/motorola_arris.js",
    defaultIP: "192.168.100.1"
  },
     {
       id: "netgear_cm2000",
       name: "Netgear Nighthawk CM2000",
       driverPath: "modems/Netgear_cm2000.js",
       defaultIP: "192.168.100.1"
     }
  // To add a new modem, you only drop the file in and add one row here:
  // ,{ id: "netgear_cm", name: "Netgear Nighthawk", driverPath: "modems/netgear_cm.js", defaultIP: "192.168.1.1" }
];