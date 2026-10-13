# Lighthouse Pro — Chrome Extension

A Manifest V3 extension for expert Lighthouse audits, backed by a local Node.js agent that launches real headless Chrome. The dashboard shows real scores, lab web vitals, audit opportunities, report downloads, history, and a link to WebPageTest.

## Install (Windows)

1. Install Node.js 22+ and Google Chrome.
2. Run `scripts/start-agent.cmd` (installs Node dependencies on first launch).
3. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked** and select the repo's `extension` folder.
4. Browse a site, click the Lighthouse Pro icon. A dashboard opens and performs a real mobile Lighthouse audit. Desktop audit is available via a toggle.

The agent listens **only** on `127.0.0.1:4177`. All pages tested are fetched by a dedicated ephemeral headless Chrome process. No website changes are made, and the extension needs no API key.

Run agent tests: `cd agent && npm test`. The agent's generated `reports/` directory is gitignored. Report metrics are Lighthouse **lab** measurements, not CrUX field data. Do not equate TBT with INP.

WebPageTest's independent Lighthouse testing is available at https://www.webpagetest.org/lighthouse.
