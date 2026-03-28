# Give Me Hours - VSCode Extension

> Track your working hours directly from git commits in Visual Studio Code

![Version](https://img.shields.io/badge/version-2.3.1-blue)
![VSCode](https://img.shields.io/badge/vscode-%5E1.103.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **📅 Date Selection**: Pick any date to view hours for that week
- **📊 Repository Breakdown**: Hours worked per git repository, grouped by day
- **🤖 AI Commit Summaries**: Feed your commits to an LLM (via GitHub Copilot) for a clean, structured work summary grouped by branch — with BugHerd ticket references preserved
- **📋 Raw Commit Log**: Toggle AI off to get a plain bullet-point log of commits grouped by branch
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
| **Summary Words** | `300` | Maximum word count for AI-generated summaries (50–1000) |
| **Show Summary** | `true` | Show the commit summary column in the results table |

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

Each cell in the table has a **Summary** button that copies a work log to your clipboard.

### Use AI Commit Summary (checkbox)

**Checked (default):** Commits are sent to GitHub Copilot's LLM, which returns a structured summary:
- Branch headings formatted as `## Type: Subject - BH###` (e.g. `## Hotfix: Fix News Thumbnail - BH16`)
- BugHerd ticket IDs preserved and surfaced in headings
- Noise words removed, typos cleaned up
- One bullet per distinct piece of work

**Unchecked:** Returns a plain grouped commit log — no AI, no processing, just commits under branch headings. Useful when Copilot isn't available or you want the raw data.

> **Requires GitHub Copilot** to be installed and active in VSCode for AI summaries. Falls back to raw log automatically if no model is available.

## 🔧 Interface Controls

| Control | Description |
|---|---|
| **Day / Week** dropdown | Switch between single-day and weekly view |
| **Date picker** | Navigate to any week |
| **Decimal / Chrono** dropdown | Toggle between decimal hours (1.5) and clock format (1:30) |
| **Refresh** button | Force re-scan of all repositories |
| **Round hours** checkbox | Apply rounding and startup time to displayed hours |
| **Use AI commit summary** checkbox | Toggle LLM summarization on/off |
| **Open Settings** button | Jump to extension settings |

## 🛠️ Requirements

- **VSCode**: 1.103.0 or higher
- **Git**: Installed and configured with a global user name
- **GitHub Copilot** _(optional)_: Required for AI commit summaries

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

**AI summary falls back to raw log**
GitHub Copilot is not installed or not signed in. Install Copilot and reload VSCode.

**Status bar not showing hours**
- No commits found for the current week
- Working directory not configured
- Git repositories don't contain commits from your configured username

## 📁 Project Structure

```
give-me-hours-vscode-extension/
├── extension.js          # VSCode extension host logic
├── give-me-hours.js      # Core git scanning and hours calculation engine
├── src/
│   ├── App.jsx           # Main React UI
│   ├── components/       # ResultsTable, GetWorkSummaryButton, etc.
│   └── utils/            # hours.js, summary.js, dateUtils.js
├── build/                # Compiled React app (committed)
└── package.json          # Extension manifest and settings
```

## 🏗️ Development

Run from the command line against any directory:
```bash
node give-me-hours.js /path/to/your/repos
```

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

```bash
npm version patch   # bug fix
npm version minor   # new feature
npm version major   # breaking change

vsce package
vsce publish patch -p YOUR_PERSONAL_ACCESS_TOKEN
```

## 📝 License

MIT — see [LICENSE](LICENSE) for details.
