# Give Me Hours - VSCode Extension

> Track your working hours directly from git commits in Visual Studio Code

![VSCode](https://img.shields.io/badge/vscode-%5E1.103.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **📅 Date Selection**: Pick any date to view hours for that week
- **📊 Repository Breakdown**: Hours worked per git repository, grouped by day
- **📋 Work Log Summaries**: A tidy log of each day's commits, grouped by branch, with BugHerd tickets in the headings. Copy it, or send it to Harvest as notes.
- **🌐 All-Branch Coverage**: Fetches commits from all local and remote-tracking branches
- **⚙️ Fully Configurable**: Customize duration gaps, rounding, startup time, summary length, and more
- **🚀 Auto-Startup**: Loads automatically when VSCode starts and pre-fetches your hours in the background
- **🎨 VSCode Native**: Seamlessly adapts to your VSCode theme

## 🚀 Quick Start

1. **Install the extension** and reload VSCode
2. **Click the status bar item** (`🕒 Give Me Hours`) to open the interface
3. **Select your folder**: Click "Select Folder" and choose the directory containing your git repositories
4. **Set up Git user** (if needed): `git config --global user.name "Your Name"`
5. **View your hours** — the extension automatically scans your repos and shows the current week

## ⚙️ Configuration

Access settings via the **Open Settings** button in the interface, or search for `Give Me Hours` in VSCode Settings.

| Setting | Default | Description |
|---|---|---|
| **Working Directory** | _(empty)_ | Folder containing your git repositories |
| **Duration** | `1h` | Maximum gap between commits to count as continuous work |
| **Hours Rounding** | `0.25` | Round hours to nearest increment (0.25 = 15 min, 0 = off) |
| **Project Startup Time** | `0.5` | Hours added before each work session for ramp-up time |
| **Min Commit Time** | `0.5` | Minimum hours credited for a single commit or after a long break |
| **Summary Words** | `300` | Maximum words in a work log; extra commits are cut and counted (50–1000) |
| **Show Summary** | `true` | Show the commit summary column in the results table |
| **Fetch Before Scan** | `true` | `git fetch --all` each repo, so commits pushed from elsewhere (teammates, bots, other machines) count. Your local commits show right away; the fetch runs in the background ("Checking remotes…") and the table updates if anything new came in. Fetch only; local branches and files aren't changed. Skips repos fetched in the last 5 minutes, except on **Refresh**. |
| **Secondary Authors** | _(empty)_ | Extra git authors whose commits count as your time, separated by commas or line breaks (e.g. `site-security-watcher[bot]`). Matched as plain text against `Name <email>`. |

### Duration Examples
- `1h` = 1 hour (default)
- `30m` = 30 minutes
- `90s` = 90 seconds

## 🎯 How It Works

1. **Scans repositories** in your configured working directory (including nested repos)
2. **Reads git logs** across all branches for the selected week
3. **Groups commits by day** using your git username as the author filter
4. **Calculates intervals** between commits, applying duration gaps, rounding, and startup time
5. **Displays results** in a weekly table — click any cell's **Summary** button to get a work log for that day

## 📋 Commit Summaries

Each cell in the table has a **Summary** button that copies a work log to your clipboard. The same text is used for Harvest notes.

The log only reorganizes what your commits say; it never adds anything:
- One section per branch, with a readable heading: `hotfix/Sibling-bugs` becomes **Hotfix: Sibling Bugs**
- BugHerd tickets found in the branch name or its commits go in the heading, e.g. **Feature: News Thumbnail - BH16**
- Merge commits, duplicates and noise ("wip", "Fix", "Styles", "Ditto"…) are left out
- Long days are cut at **Summary Words**, ending with "…and N more"

```
Hotfix: Sibling Bugs
- Breadcrumbs fix
- Bump .nvmrc to Node v24.15
- Switch gsap from @gsap/business to public gsap ^3.13.0

Hotfix: Slide Toggle Cancel
- Slide toggle: cancel in-flight slides before reversing them
```

> AI summaries were removed. Copilot wasn't available to us, so they always fell back to the plain log anyway. Apple's on-device model was tested as a replacement and invented work and ticket numbers, which doesn't belong in client billing notes.

## 🔧 Interface Controls

| Control | Description |
|---|---|
| **Day / Week** dropdown | Switch between single-day and weekly view |
| **Date picker** | Navigate to any week |
| **Decimal / Chrono** dropdown | Toggle between decimal hours (1.5) and clock format (1:30) |
| **Refresh** button | Fetch every repo from its remotes, then re-scan |
| **Round hours** checkbox | Apply rounding and startup time to displayed hours |
| **Include secondary accounts** checkbox | Count commits from **Secondary Authors** in hours, summaries and Harvest notes. Shown only when that setting has names. Your choice is remembered (setting **Include Secondary Authors**). |
| **Open Settings** button | Jump to extension settings |
| **Add time to Harvest** button | Send the hours on screen (the selected day, or the whole week) to Harvest. Reads **Configure Harvest** until you've set it up. Harvest is optional. |

## ⏱️ Harvest

Send your hours straight to [Harvest](https://www.getharvest.com), one time entry per repo per day, with the day's summary as notes.

### Connect

1. Create a **Personal Access Token** (not an OAuth application) at [id.getharvest.com/developers](https://id.getharvest.com/developers): click **Create new personal access token**, then copy **Your Token**. You don't need the Account ID.
2. Click **Configure Harvest** (in the header, or the "New" banner), or run **Give Me Hours: Configure Harvest**, and paste the token. It's stored in VS Code's secret storage.
3. Pick a **fallback project and task**, e.g. *Internal 2026 › Non-Billable Development*. Time for any repo without its own project goes here. Change it later with **Give Me Hours: Change Harvest Fallback Project**.

Harvest is optional: hours, summaries and copying all work without it. If you don't use Harvest, click **Not now** on the banner and it won't come back. The header's **Configure Harvest** button stays available.

If Harvest can't be reached (offline, outage), the panel says so and offers **Retry**. If your token is revoked, it offers **Reconnect**. If there's no fallback project, it offers **Choose fallback**.

### Change account or disconnect

Open the **Harvest** section in the panel (its title shows the status, e.g. "Harvest · Connected to Mellenger"):
- **Change account or token:** paste a new token, or switch to another Harvest account. Cancelling keeps your current connection.
- **Change fallback:** pick a different fallback project.
- **Disconnect:** asks to confirm, then removes the token from this machine. Your repo project picks and fallback stay in settings, so reconnecting picks up where you left off. After switching accounts, picks for projects the new account can't see go back to the fallback until you re-pick them.

The same actions are in the command palette (**Give Me Hours: Configure Harvest**, **Change Harvest Fallback Project**, **Disconnect Harvest**) and as links in the Harvest settings under **Settings → Give Me Hours**.

### Pick a project per repo

Each repo in the table has a dropdown under its name. Choose a Harvest project; the task defaults to *Web Development* when it's available, and a task dropdown appears if the project has others. Picks are saved immediately (setting `giveMeHours.harvestProjects`, keyed by `owner/repo`).

Repos you've tracked time against from GitHub issues in the last 6 months are pre-filled with that project, marked *Suggested from past Harvest entries*.

### Send

**Add time to Harvest** in the header sends the whole day or week. To send just one repo on one day, use **Add to Harvest** in that table cell. Either way you review the project and hours before anything is sent.

Every send **adds new entries**. If you've already sent the same day, week or cell, you'll see when and how much before confirming. Cells that have been sent (from either button) show **✓ In Harvest**; hover for the time and hours.

Notes use the same work log as the **Summary** button.

## 🛠️ Requirements

- **VSCode**: 1.103.0 or higher
- **Git**: Installed and configured with a global user name

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## 🔍 Troubleshooting

**"Git global username is not set"**
Run `git config --global user.name "Your Name"` in terminal.

**"Please configure a working directory"**
Click "Select Folder" and choose the folder containing your git repositories.

**Summary shows "No activity found for this day"**
The summary queries the same date range as the table. If the table shows hours but summary shows nothing, check that your git global username exactly matches the author name in those commits.

**Status bar not showing hours**
- No commits found for the current week
- Working directory not configured
- Git repositories don't contain commits from your configured username

## 📁 Project Structure

```
give-me-hours-vscode-extension/
├── extension.js           # VSCode extension host logic
├── give-me-hours.js       # Core git scanning and hours calculation engine
├── harvest.js             # Harvest API v2 client
├── harvest-controller.js  # Harvest onboarding, token storage, mappings, sending
├── src/
│   ├── App.jsx            # Main React UI
│   ├── components/        # ResultsTable, CopyButton, HarvestDialog, HarvestProjectSelect, etc.
│   └── utils/             # hours.js, processResults.js, harvestMapping.js, request.js, dateUtils.js
├── build/                 # Compiled React app (generated by `yarn build`, gitignored)
├── .github/workflows/     # release.yml: publishes to the Marketplace on merge to main
└── package.json           # Extension manifest and settings
```

## 🏗️ Development

### Running the engine manually

`give-me-hours.js` can be run directly with Node for fast testing without launching the extension:

```bash
# Scan a directory for today's hours
node give-me-hours.js ~/Web

# Specific date (single day)
node give-me-hours.js ~/Web/my-project --date 2026-03-28

# Full week view
node give-me-hours.js ~/Web/my-project --weekOf 2026-03-28

# Multiple directories at once
node give-me-hours.js ~/Web ~/Work --date yesterday

# Disable rounding to see raw unrounded hours
node give-me-hours.js ~/Web --rounding 0

# Custom session gap and rounding
node give-me-hours.js ~/Web --duration 2h --rounding 0.5 --min-time 0.25

# Show per-commit breakdown
node give-me-hours.js ~/Web --date today --debug

# Get raw JSON output (useful for piping or inspection)
node give-me-hours.js ~/Web --json

# Full options reference
node give-me-hours.js --help
```

**Available options:**

| Flag | Default | Description |
|---|---|---|
| `--date` | `today` | Show a single day: `today`, `yesterday`, or `YYYY-MM-DD` |
| `--weekOf` | — | Show the full week containing this date (mutually exclusive with `--date`) |
| `--duration` | `1h` | Max gap between commits to count as one session (`1h`, `30m`, etc.) |
| `--rounding` | `0.25` | Round up to nearest N hours; `0` to disable |
| `--min-time` | `0.5` | Minimum hours credited per isolated commit |
| `--words` | `50` | Max words in summary output |
| `--no-fetch` | _(fetch on)_ | Skip `git fetch` before scanning (local commits only) |
| `--secondary-authors` | _(none)_ | Comma-separated extra git authors whose commits count as your time |
| `--debug` | off | Print git commands and per-commit intervals |
| `--json` | off | Output raw JSON instead of formatted text |

Inspect raw git output for a date range:
```bash
git log --pretty=format:'%at|%s' --reverse \
  --since="2025-09-01" --before="2025-09-02" \
  --author="Your Name"
```

Build the React webview after UI changes:
```bash
npm run build
```

### Publishing to VSCode Marketplace

Publishing is automatic: every merge to `main` runs `.github/workflows/release.yml`, which bumps the version, tags it, publishes to the Marketplace, and creates a GitHub Release with the `.vsix`.

- **Patch** (default): just merge.
- **Minor / major:** put `[minor]` or `[major]` in the PR title.
- Or bump locally with `npm version minor|major` and `git push --follow-tags`.

Auth uses Marketplace Trusted Publishing (GitHub OIDC), so there's no token to manage.

## 📝 License

MIT — see [LICENSE](LICENSE) for details.
