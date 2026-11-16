# Give Me Hours: notes for coding agents

VS Code extension that estimates hours worked per repo per day from git commits, with a React webview UI and a Harvest integration. User-facing docs are in README.md.

## Architecture
- **Extension host (CommonJS, Node):**
  - `extension.js`: activation, commands, webview panel, and one `switch` handling every webview message.
  - `give-me-hours.js`: git scanning. `getHoursForDirectory` returns raw commits plus `remote` ("owner/repo") per repo.
  - `harvest.js`: Harvest API v2 client, using global `fetch`.
  - `harvest-controller.js`: token in `context.secrets`; account, suggestion cache and previous sends in `globalState`; mappings and the fallback in settings.
- **Webview (React, CRA → `build/`):** `src/`. Hours are calculated **in the webview** (`src/utils/processResults.js` → `hours.js`). The host only sends commits.
- **Messages:** webview → host is `{command, ...}`; host → webview is `{type, ...}`. For request/reply, use `requestFromHost` in `src/utils/request.js`, which matches replies by `requestId`.
- **Clipboard:** always copy through the host (`copyToClipboard` message / `src/utils/clipboard.js`). `navigator.clipboard` fails when the webview isn't focused.

## Harvest
- Project for a repo: saved pick (`giveMeHours.harvestProjects`, keyed `owner/repo` or folder name) → suggestion (past entries whose `external_reference.permalink` is a GitHub URL) → fallback (`giveMeHours.harvestDefault`). See `src/utils/harvestMapping.js`.
- Settings changes trigger `onDidChangeConfiguration`, which pushes `harvestState` to all open panels.
- Sends always add new entries. The warning about a repeat send is keyed `day:YYYY-MM-DD` / `week:<Monday>`.
- Repo ↔ Harvest links really live in BugHerd. Auto-mapping through the BugHerd API is a possible follow-up.

## Styling
`src/App.css` forces every `vscode-button` to brand teal using `::part(control)`, because VS Code injects theme tokens later. Overrides such as `.primary-button` must come after that rule.

## Build, run, release
- `yarn build` for the webview, then F5 ("Run Extension") opens an Extension Development Host. Rebuild and reload that window after React changes.
- `yarn lint`. There's no meaningful test suite; test changes by hand in the dev host.
- Release: merge to `main`, and `.github/workflows/release.yml` publishes. Put `[minor]`/`[major]` in the PR title to bump more than a patch. The Marketplace's live version decides whether to bump. Auth is Trusted Publishing (OIDC); the Marketplace policy names `release.yml`, so don't rename it.
- The Marketplace rejects icons over 1024×1024 (`public/logo.png` is 256×256).
