# Give Me Hours: notes for coding agents

VS Code extension that estimates hours worked per repo per day from git commits, with a React webview UI and a Harvest integration. User-facing docs are in README.md.

## Architecture
- **Extension host (CommonJS, Node):**
  - `extension.js`: activation, commands, webview panel, and one `switch` handling every webview message.
  - `give-me-hours.js`: git scanning. `getHoursForDirectory` returns raw commits plus `remote` ("owner/repo") per repo.
    - Authors: `[git user.name, ...secondaryAuthors]` become several `--author` flags with `--fixed-strings` (so `[bot]` isn't a regex). Commits by anyone but the first author get `isSecondary: true`.
    - The extension scans in two steps (`runScan` in extension.js): local commits first (`fetch: false`), sent right away with `fetching: true`; then `fetchRepos` in the background, and a rescan only if `fetch.changed` is non-empty. Scans for the same week are shared (`inflight`), and results go to every open panel. The CLI still fetches inline before scanning.
    - `fetchRepos` runs `git fetch --all --porcelain` (no pull, no prune, no `--quiet`, which hides the porcelain lines used to detect changes) on every repo in parallel (8 at a time, 30s timeout, `GIT_TERMINAL_PROMPT=0`). Repos attempted in the last 5 minutes are skipped unless `forceFetch` (the Refresh button) is set. Failures come back in `result.fetch.failed` and show in the panel. Setting: `giveMeHours.fetchBeforeScan`; CLI: `--no-fetch`.
    - The host always includes secondary authors' commits. The webview's "Include secondary accounts" checkbox filters them in `processResults`, and is passed as `includeSecondary` to summaries and Harvest sends. Toggling it posts `setIncludeSecondary`, which saves `giveMeHours.includeSecondaryAuthors`; the webview starts from that value in `config`. The toolkit checkbox fires `change` on programmatic updates too, so the handler ignores no-op changes.
  - `work-log.js`: `formatWorkLog(commits, {maxWords})`, the text for the Summary button and Harvest notes. It's deterministic on purpose: branch headings, BH tickets, and dropping merges, noise and duplicates. Don't reintroduce LLM summaries without checking quality. Copilot wasn't available, and Apple's on-device model invented work and ticket numbers.
  - `harvest.js`: Harvest API v2 client, using global `fetch`.
  - `harvest-controller.js`: token in `context.secrets`; account, suggestion cache and previous sends in `globalState`; mappings and the fallback in settings.
- **Webview (React, CRA → `build/`):** `src/`. Hours are calculated **in the webview** (`src/utils/processResults.js` → `hours.js`). The host only sends commits.
- **Messages:** webview → host is `{command, ...}`; host → webview is `{type, ...}`. For request/reply, use `requestFromHost` in `src/utils/request.js`, which matches replies by `requestId`.
- **Clipboard:** always copy through the host (`copyToClipboard` message / `src/utils/clipboard.js`). `navigator.clipboard` fails when the webview isn't focused.

## Harvest
- Project for a repo: saved pick (`giveMeHours.harvestProjects`, keyed `owner/repo` or folder name) → suggestion (past entries whose `external_reference.permalink` is a GitHub URL) → fallback (`giveMeHours.harvestDefault`). See `src/utils/harvestMapping.js`.
- Settings changes trigger `onDidChangeConfiguration`, which pushes `harvestState` to all open panels.
- Optional by design. Not connected: a regular "Configure Harvest" button, plus a one-time intro banner until "Not now" (`globalState` `harvest.introDismissed`). `getState()` returns `{connected:false, error}` on 401 (Reconnect), `{connected:true, unavailable:true, error}` on network failures (Retry clears caches; Add is disabled), and the panel asks for a fallback when `harvestDefault` is missing or no longer valid. Prompts are `HarvestNotices` in `App.jsx`. Connection controls (change account or token, change fallback, disconnect with an inline confirm) are `HarvestSettings`, its own accordion under Configuration, titled with the status. The Harvest settings' `markdownDescription`s link to the commands (`command:give-me-hours.…`), since the Settings UI can't host buttons. Disconnect keeps mappings and the fallback in settings, and sets `introDismissed`.
- Sends always add new entries. Repeat-send warnings are keyed `day:YYYY-MM-DD` (header Day view, or a day column's total), `week:<Monday>` (header Week view), `repoweek:<folder>:<Monday>` (a repo's week total) or `cell:<folder>:<date>` (one cell). The table buttons are all `HarvestCellButton` with a list of rows; it shows "✓ n/m in Harvest" for partial totals. Every send also accumulates a `cell:` record for each repo/day it created, which drives the cell's "✓ In Harvest". `cellSendKey` exists in both `harvest-controller.js` and `src/utils/harvestMapping.js`; keep them in sync.
- Dates: never `new Date('YYYY-MM-DD')` in the webview. It's UTC midnight, i.e. the previous day west of UTC. Use `createDate()` from `src/utils/dateUtils.js`.
- Repo ↔ Harvest links really live in BugHerd. Auto-mapping through the BugHerd API is a possible follow-up.

## Styling
`src/App.css` forces every `vscode-button` to brand teal using `::part(control)`, because VS Code injects theme tokens later. Overrides such as `.primary-button` must come after that rule.

## Build, run, release
- `yarn build` for the webview, then F5 ("Run Extension") opens an Extension Development Host. Rebuild and reload that window after React changes.
- `.vscode/settings.json` turns off `debug.javascript.enableNetworkView`. With it on, the dev host's extension host aborts (SIGABRT in `node::inspector::Agent::ToggleNetworkTracking`) as soon as the debugger attaches.
- Git scans run with `execSync` on the extension host, so a refresh freezes it for a few seconds ("extension host unresponsive" in the logs). That's expected for now.
- `yarn lint`. There's no meaningful test suite; test changes by hand in the dev host.
- Release: merge to `main`, and `.github/workflows/release.yml` publishes. Put `[minor]`/`[major]` in the PR title to bump more than a patch. A version counts as released when its GitHub Release exists; the workflow creates one only after a successful publish. Don't go back to checking the Marketplace listing: it lags about 10 minutes, so back-to-back merges reused a version (#28's `[minor]` was lost that way). Auth is Trusted Publishing (OIDC); the Marketplace policy names `release.yml`, so don't rename it.
- The Marketplace rejects icons over 1024×1024 (`public/logo.png` is 256×256).
