# Privacy Policy for Universal Node Congestion Tracker

**Effective Date:** June 6, 2026

The **Universal Node Congestion Tracker** ("we," "our," or "the Extension") is committed to protecting user privacy. This Privacy Policy explains our practices regarding data collection, storage, and usage when you use our Google Chrome extension.

---

## 1. Information We Do Not Collect

We believe in absolute data privacy. The Extension is engineered to be entirely self-hosted and localized.

* **No Personal Data Collection:** We do not collect, store, or transmit any personally identifiable information (PII) such as names, email addresses, phone numbers, or account credentials.
* **No Telemetry or Analytic Tracking:** We do not track your browsing history, search queries, or behavior across the web.
* **No External Data Transmission:** Any network health parameters parsed by the Extension—including Signal-to-Noise Ratio (SNR) values, frequency data, and codeword error counters—are never transmitted to an external server or third party.

---

## 2. Local Storage and Data Processing

To fulfill its core diagnostic purpose, the Extension processes and retains data exclusively within your local device environment:

* **Modem Diagnostics:** The Extension reads the local hardware diagnostic status tables (e.g., `192.168.100.1` or `192.168.0.1`) only when you navigate to those specific local endpoints.
* **`chrome.storage.local` API:** The connection metrics scraped by the Extension are written directly to your browser's local sandbox environment to draw your history timeline chart.
* **User Control:** Your logged history remains on your machine. You can clear this data at any time by utilizing the manual data reset tools inside the Extension's Option panel, or by uninstalling the Extension.

---

## 3. Chrome Permissions Utilized

The Extension requests minimal browser permissions to operate:

* **`storage`:** Required to save your historical diagnostic logs and configuration states (such as turning the tracking engine ON or OFF) directly inside your browser.

---

## 4. Third-Party Services

The Extension does not integrate with any third-party APIs, advertising networks, or remote analytics frameworks. Your data is never shared, sold, or rented to anyone.

---

## 5. Compliance with the Google User Data Policy

The Universal Node Congestion Tracker strictly adheres to the Google Chrome Web Store User Data Policy, including the **Limited Use** requirements. We only handle data that is strictly necessary to display your local network health metrics on your dashboard.

---

## 6. Changes to This Privacy Policy

We may update our Privacy Policy from time to time to reflect modifications to the Extension's local capabilities. Any updates will be pushed directly to the Chrome Web Store alongside version updates, and the "Effective Date" at the top of this page will be revised accordingly.

---

## 7. Contact Us

If you have any questions or feedback regarding this Privacy Policy or the security of your local data, you can reach out via our GitHub repository issue page or via the developer contact options listed on the Google Chrome Web Store.