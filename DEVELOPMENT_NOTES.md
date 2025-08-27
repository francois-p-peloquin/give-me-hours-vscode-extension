# Give Me Hours VSCode Extension - Development Notes

## Project Overview
Converting a bash script called "give-me-hours" from `../give-me-hours-homebrew/` into a VSCode extension that calculates working hours from git commits across multiple repositories.

## Completed Work

### ✅ Core Implementation
1. **Bash Script Analysis**: Examined the original bash script at `/Users/francoispeloquin/Web/give-me-hours-homebrew/give-me-hours`
   - Script calculates working hours from git commits
   - Uses configurable duration, rounding, and padding settings
   - Scans directories for git repositories
   - Formats output as hours:minutes

2. **NodeJS Conversion**: Created `git-hours.js` with all core functionality:
   - `GitHours` class with methods for parsing duration, rounding hours, calculating working time
   - Git command execution using `execSync`
   - Directory scanning for git repositories
   - Date range handling (today, yesterday, specific dates)

3. **VSCode Extension Settings**: Added to `package.json`:
   - `giveMeHours.workingDirectory` (default: "/Users/francoispeloquin/Web/")
   - `giveMeHours.duration` (default: "1h") 
   - `giveMeHours.hoursRounding` (default: 0.25)
   - `giveMeHours.paddingBefore` (default: 0.5)
   - `giveMeHours.words` (default: 50)

4. **UI Implementation**: Created `hours-panel.html`:
   - Clean webview interface with VSCode theming
   - Shows working hours by repository in a table
   - Displays total hours, date range, git username, current config
   - Has Refresh, Select Folder, and Settings buttons
   - Error handling and loading states

5. **Extension Integration**: Updated `extension.js`:
   - Status bar item that opens the hours panel
   - Webview creation and message handling
   - Configuration loading and validation
   - Working directory validation before script execution

### ⚠️ Current Issues

#### 🚨 PRIMARY ISSUE: "Select Folder" Button Not Working
- User reports clicking "Select Folder" button does nothing
- The button should trigger `vscode.window.showOpenDialog()` to let user pick working directory
- Need to debug the webview-to-extension message passing

#### Potential Causes:
1. **Message Handler Not Receiving**: The `selectFolder` command might not be reaching the extension
2. **Dialog Not Opening**: The `showOpenDialog` might be failing silently
3. **JavaScript Error**: Could be a JS error in the webview preventing the message from being sent

### 🔧 Files Created/Modified
- `git-hours.js` - Core NodeJS implementation
- `hours-panel.html` - Webview UI
- `extension.js` - Extension logic with webview handling
- `package.json` - Added configuration properties

### 🎯 Next Steps to Fix "Select Folder" Issue
1. **Debug Message Passing**: Add console.log statements to verify messages are being sent/received
2. **Test Dialog Directly**: Try calling `showOpenDialog` from a command to verify it works
3. **Check Webview Context**: Ensure the webview has proper permissions and context
4. **Add Error Handling**: Wrap the folder selection in try-catch to see any errors

### 📝 User Requirements (from CLAUDE.md)
- ✅ VSCode extension setting for folder where script runs
- ✅ Script runs and displays hours on extension screen open  
- ✅ Convert bash script to NodeJS (better for VSCode extension)
- ✅ User-defined settings for duration, words, hours-rounding, padding-before with defaults

### 🏗️ Current Architecture
```
extension.js (main)
├── GitHours class (git-hours.js)
├── Webview Panel (hours-panel.html)
└── VSCode Settings (package.json)
```

The extension is mostly complete but needs debugging of the folder selection functionality.