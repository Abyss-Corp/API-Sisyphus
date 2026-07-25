<div align="center">

# 🪨 API Sisyphus

### The Zero-Install API Testing Tool — Now With Tabs, Collections, Environments & cURL

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel)](https://api-sisyphus.vercel.app/)
[![Sponsor](https://img.shields.io/badge/Sponsor-Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/YOUR_USERNAME_HERE)
[![GitHub Repo stars](https://img.shields.io/github/stars/asimayazmrd0987-glitch/API-Sisyphus?style=for-the-badge&color=blue)](https://github.com/asimayazmrd0987-glitch/API-Sisyphus/stargazers)

*Named after the Greek mythological figure condemned to roll a boulder up a hill for eternity—because testing APIs sometimes feels exactly like that.*

</div>

---

## 🌟 Why API Sisyphus?

Heavy API clients like Postman or Insomnia are great, but they require Electron installations, consume massive amounts of RAM, and slow down your workflow when you just need to test a quick JSON endpoint.

**API Sisyphus** is a lightweight, browser-based alternative built entirely in static HTML/CSS/JS (ES modules, no build step, no framework). It leverages the browser's native `fetch()` API and `localStorage` to provide a blazing-fast, zero-setup testing environment — that now scales past "one request at a time."

### ✨ Core Features
- **⚡ Zero Setup:** No npm install, no Electron. Static files served by any web server.
- **🔄 Full HTTP Support:** GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.
- **🗂️ Request Tabs:** Work on multiple requests at once, browser-tab style — switch, close, reopen.
- **📁 Collections:** Save and organize named requests into folders, not just a flat history. Export/import as JSON.
- **🕘 History:** Every request you send is auto-logged separately from Collections, so nothing is ever lost even if you forget to save it.
- **🌍 Multiple Named Environments:** Define several environments (Dev/Staging/Prod), switch between them from the top nav, and inject variables anywhere with `{{variable_name}}`.
- **⌨️ cURL Import/Export:** Paste a curl command to instantly create a request, or copy any request as a ready-to-run curl command.
- **✅ Test Assertions:** Attach pass/fail checks to a request — status code, response time, header value, body contains, or a JSON path equality — evaluated automatically after every send.
- **🔍 Response Search:** Filter/highlight matches inside a JSON response body.
- **🛑 Cancel & Timeout:** Abort an in-flight request, or set a per-request timeout.
- **🎨 Developer UX:** Dark mode UI, JetBrains Mono typography, custom JSON syntax highlighting.

---

## 🚀 Try It Live
👉 **[https://api-sisyphus.vercel.app/](https://api-sisyphus.vercel.app/)**

---

## 📖 Quick Start Guide

### 1. Environment Variables
1. Click the gear icon next to the environment dropdown (top-right) to open **Environments**.
2. Create an environment (e.g. "Dev"), add `API_BASE = https://jsonplaceholder.typicode.com`.
3. Select it from the dropdown in the top nav.
4. In the URL bar, type: `{{API_BASE}}/users/1` and hit **SEND** (or `Ctrl/Cmd + Enter`).

### 2. Collections
- Hit **Save** on any request (or `Ctrl/Cmd + S`) to add it to a collection.
- Click a saved request in the sidebar to reopen it in a tab — editing it won't affect the saved copy until you hit Save again.
- Export a collection to a JSON file from its `⋯` menu to share it with a teammate; they import it with the upload icon in the Collections header.

### 3. cURL Import/Export
- **Import:** Click **Import cURL** in the request bar, paste a curl command (method, URL, headers, body, `-u`/bearer auth are all parsed), click Import.
- **Export:** Click **Copy cURL** on any request to copy a ready-to-run curl command — env variables are resolved to their literal values so it runs standalone in a terminal.

### 4. Tests
1. Open the **Tests** tab in the request pane.
2. Add a check, e.g. "Status code equals 200" or "JSON path `data.id` exists."
3. Send the request — results show as pass/fail chips in the Tests tab and in the response's Tests tab, plus a summary chip in the response meta bar.

### 5. Tabs & History
- `Ctrl/Cmd + T` — new tab · `Ctrl/Cmd + W` — close tab · `Ctrl/Cmd + Enter` — send.
- Every send is logged in **History** (left sidebar) regardless of whether you save it — click any entry to reopen it in a new tab.

---

## ⚠️ The CORS Reality (Please Read)

Because API Sisyphus runs natively inside your web browser, it is bound by the browser's **Cross-Origin Resource Sharing (CORS)** security policies.

*   **✅ What Works:** Public APIs designed for developers (GitHub API, Stripe Test API, PokeAPI, JSONPlaceholder).
*   **❌ What Fails:** Highly secure or consumer-facing sites (YouTube, Netflix, Banking APIs) that block browser-based scraping. You will see a `Failed to fetch` error. *This is your browser protecting you, not a bug in the tool.*

---

## 💻 Run Locally (For Developers)

This app now uses native ES modules (`<script type="module">`), which **browsers refuse to load over `file://`** — you can no longer just double-click `index.html`. Serve it over `http://` instead (still zero-install, just needs any static file server):

**Option 1: Python (Fastest)**
```bash
python3 -m http.server 8080
# Visit http://localhost:8080
```

**Option 2: Docker (matches production)**
```bash
docker build -t api-sisyphus .
docker run -p 8080:80 api-sisyphus
# Visit http://localhost:8080
```

---

## 📁 Project Structure

```
API-Sisyphus/
├── index.html          # shell — loads all CSS/JS, no build step
├── Dockerfile
├── nginx.conf
├── css/
│   ├── base.css         # design tokens, reset, top nav
│   ├── components.css    # buttons, badges, modals, kv rows
│   ├── tabs.css            # request tab bar
│   ├── sidebar.css          # Collections tree + History list
│   ├── request.css           # request pane (params/headers/auth/body/tests)
│   └── response.css           # response pane, JSON viewer, search
└── js/
    ├── state.js          # central state + localStorage persistence
    ├── storage.js          # localStorage wrapper
    ├── dom.js                # small DOM/formatting helpers
    ├── kvrows.js               # reusable key-value row list component
    ├── request.js                # env resolution, headers/body/auth, fetch + AbortController
    ├── curl.js                     # curl command parse + generate
    ├── tests.js                      # assertion definitions + runner
    ├── tabs.js                         # tab bar + request pane (biggest module)
    ├── response.js                       # response pane + JSON syntax highlight + search
    ├── environments.js                     # environment selector + manage modal
    ├── collections.js                        # collections sidebar + save modal
    ├── history.js                              # auto-logged request history
    ├── toast.js                                  # notifications
    └── main.js                                     # wires everything together on load
```

Each module has one job — if you're extending this, `tabs.js` and `state.js` are the two files most things touch.

---

## 🤝 Contributing

Issues and PRs welcome. A few useful entry points if you want to extend it:
- New test assertion type → add a case to `tests.js`'s `runAssertions`/`createTest`, and a matching branch in `tabs.js`'s `testFieldsHtml`.
- New auth type → extend `buildAuthHeaders` in `request.js` and `renderAuthTab` in `tabs.js`.
- New body type (e.g. GraphQL, XML) → extend `buildBody` in `request.js` and `renderBodyTab` in `tabs.js`.

## 📄 License

See [LICENSE](LICENSE).
