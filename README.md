# Give Me Hours - VSCode Extension

> Track your working hours directly from git commits in Visual Studio Code

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![VSCode](https://img.shields.io/badge/vscode-%5E1.103.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **🕒 Live Status Bar**: See your daily working hours at a glance in VSCode's status bar
- **📅 Date Selection**: Pick any date with an intuitive calendar widget
- **📊 Repository Breakdown**: View hours worked per git repository
- **💬 Commit Summaries**: See what you worked on with toggleable commit message summaries
- **⚙️ Fully Configurable**: Customize duration gaps, rounding, startup time, and more
- **🚀 Auto-Startup**: Extension loads automatically when VSCode starts
- **🎨 VSCode Native**: Perfect integration with VSCode themes and UI patterns

## 🖼️ Screenshots

### Status Bar Integration
```
[🕒 Give Me Hours: 3:45] [Other extensions...]
```

### Main Interface
- Clean, VSCode-themed interface
- Date picker for any date selection
- Repository breakdown with hours worked
- Commit summaries with smart truncation
- Configuration display with easy settings access

## 📦 Installation

### From Source
1. Clone this repository
2. Open in VSCode
3. Press `F5` to run the extension in a new Extension Development Host window

## 🚀 Quick Start

1. **Install the extension** and reload VSCode
2. **Notice the status bar**: `🕒 Give Me Hours` appears in the bottom status bar
3. **Click the status bar item** to open the main interface
4. **Select your repository folder**: Click "Select Folder" and choose the directory containing your git repositories
5. **Set up Git user** (if needed): Run `git config --global user.name "Your Name"` in terminal
6. **View your hours**: The extension automatically calculates and displays your working hours!

## ⚙️ Configuration

Access settings via:
- **Settings UI**: Search for "Give Me Hours" in VSCode Settings
- **Command Palette**: `Give Me Hours: Open Settings`
- **Extension Interface**: Click the "Settings" button

### Available Settings

| Setting | Default | Description |
|---|---|---|
| **Working Directory** | _(empty)_ | Folder containing your git repositories |
| **Duration** | `1h` | Maximum gap between commits to count as continuous work |
| **Hours Rounding** | `0.25` | Round hours to nearest increment (0.25 = 15 min) |
| **Project Startup Time** | `0.5` | Add time before each work session (0.5 = 30 min) |
| **Min Commit Time** | `0.5` | Minimum time credited for a single commit or a commit after a long break, in hours. 0.5 = 30 minutes. |
| **Words** | `50` | Maximum words in commit summaries |
| **Show Summary** | `true` | Display commit message summaries in table |
| **Data Type** | `rounded` | Choose between `rounded` and `clean` hours. |

### Data Types: Clean vs. Rounded Hours

You can now choose how your hours are calculated and displayed:

- **Rounded Hours (default)**: This mode includes all the smart calculations, such as rounding and project startup time. This is useful for getting a more realistic view of your billable hours.
- **Clean Hours**: This mode shows the raw, unadjusted time calculated from your commit history. This is useful for getting a precise measure of your coding time without any adjustments.

Use the "Hours type" toggle in the extension's main interface to switch between these modes.

### Duration Examples
- `1h` or `1` = 1 hour
- `30m` = 30 minutes
- `90s` = 90 seconds

### Rounding Examples
- `0.25` = Round to nearest 15 minutes
- `0.5` = Round to nearest 30 minutes
- `1` = Round to nearest hour
- `0` = No rounding

## 🎯 How It Works

The extension analyzes your git commit history to calculate working hours:

1. **Scans repositories** in your configured working directory
2. **Reads git logs** for the selected date range
3. **Calculates intervals** between commits by the same author
4. **Applies logic**:
   - Groups commits within the duration threshold (default: 1 hour)
   - Adds project startup time for context switching
   - Rounds hours based on your preference
5. **Displays results** in an easy-to-read format

## 🔧 Usage

### Status Bar
- **Live Updates**: Shows current working hours automatically
- **Click to Open**: Access the full interface instantly
- **Smart Tooltips**: Contextual information based on your setup

### Main Interface
- **Date Selection**: Use the calendar to view hours for any date
- **Repository Breakdown**: See hours worked per project
- **Commit Summaries**: Toggle detailed view of what you worked on
- **Quick Actions**: Refresh data, change folders, access settings

### Keyboard Shortcuts
- `Ctrl+Shift+P` → "Give Me Hours: Open Settings"
- `Ctrl+Shift+P` → "Give Me Hours: Open Welcome Page"

## 🛠️ Requirements

- **VSCode**: Version 1.103.0 or higher
- **Git**: Installed and configured with global user name
- **Git Repositories**: Projects with commit history in a common folder

### Setup Git User
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## 🎨 Customization

### VSCode Theme Integration
The extension automatically adapts to your VSCode theme:
- Dark themes: Uses dark color palette
- Light themes: Uses light color palette
- High contrast themes: Maintains accessibility

### Summary Display
Toggle commit summaries on/off to customize your view:
- **With summaries**: See what you worked on
- **Without summaries**: Clean, minimal hours-only view

## 🔍 Troubleshooting

### "Git global username is not set"
**Solution**: Run `git config --global user.name "Your Name"` in terminal

### "Please configure a working directory"
**Solution**: Click "Select Folder" and choose the folder containing your git repositories

### Status bar not showing hours
**Possible causes**:
- No commits made today
- Working directory not configured
- Git repositories don't contain commits from you

### Extension not loading
**Solution**: Check VSCode extension is activated. Look for status bar item on startup.

## 📁 Project Structure

```
give-me-hours/
├── give-me-hours.js      # Core calculation engine
├── hours-panel.html      # Main webview interface
├── extension.js          # VSCode extension logic
├── package.json          # Extension manifest
├── README.md            # This file
└── DEVELOPMENT_NOTES.md # Development documentation
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

### Development Setup
1. Clone the repository
2. Open in VSCode
3. Press `F5` to run in Extension Development Host
4. Make changes and test
5. Submit pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the original bash script concept
- Built with the VSCode Extension API
- Uses VSCode's theming system for seamless integration

## 🔗 Links

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Git Documentation](https://git-scm.com/doc)
- [Issue Tracker](https://github.com/your-repo/give-me-hours/issues)

---

**Happy coding and time tracking! 🚀**

# Development
To run in any directory, try the following, pointing to your working directory:
```bash
node give-me-hours.js /Users/francoispeloquin/Web
```

To review what Git is logging in each folder, use:
```bash
git log --pretty=format:'%at|%s' --reverse --since="2025-09-01"  --before="2025-09-02" --author="Francois Peloquin"
```

# Developemt

## VSCode Marketplace
Publish a new patch + publish:
```bash
# Update the version
npm version patch  # for bug fixes (1.0.0 -> 1.0.1)
npm version minor  # for new features (1.0.0 -> 1.1.0)
npm version major  # for breaking changes (1.0.0 -> 2.0.0)

# Package the extension
vsce package
vsce package

# Publish it
vsce publish
vsce publish -p YOUR_PERSONAL_ACCESS_TOKEN

# OR increment a patch and publish it
vsce publish patch -p YOUR_PERSONAL_ACCESS_TOKEN
```
