// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const GiveMeHours = require('./give-me-hours');
const fs = require('fs');
const path = require('path');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "give-me-hours" is now active!');

	let currentDate = 'today'; // Track the current date selection

	// Create status bar item
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.text = "$(clock) Give Me Hours";
	statusBarItem.tooltip = "Click to view your working hours";
	statusBarItem.command = 'give-me-hours.openWelcome';
	statusBarItem.backgroundColor = undefined; // No background color by default
	statusBarItem.show();

	// Function to update status bar with current hours
	async function updateStatusBar() {
		try {
			const config = getConfiguration();
			if (!isWorkingDirectoryConfigured()) {
				statusBarItem.text = "$(clock) Give Me Hours";
				statusBarItem.tooltip = "Click to configure working directory";
				return;
			}

			const workingDirectory = getWorkingDirectory();
			const tempGiveMeHours = new GiveMeHours();
			const duration = tempGiveMeHours.parseDuration(config.duration);
			
			const giveMeHours = new GiveMeHours({
				duration: duration,
				hoursRounding: config.hoursRounding,
				projectStartupTime: config.projectStartupTime,
				showSummary: false, // Don't need summaries for status bar
				maxWords: config.words,
				debug: false
			});

			const result = await giveMeHours.getHoursForDirectory(workingDirectory, currentDate);
			
			if (result.total.seconds > 0) {
				statusBarItem.text = `$(clock) Give Me Hours: ${result.total.formatted}`;
				statusBarItem.tooltip = `Today's working hours: ${result.total.formatted} - Click to view details`;
			} else {
				statusBarItem.text = `$(clock) Give Me Hours: 0:00`;
				statusBarItem.tooltip = `No working hours logged today - Click to view details`;
			}
		} catch (error) {
			statusBarItem.text = "$(clock) Give Me Hours";
			if (error.message.includes('Git global username is not set')) {
				statusBarItem.tooltip = "Git username not set - Click to configure";
			} else {
				statusBarItem.tooltip = "Click to view your working hours";
			}
		}
	}

	// Update status bar on startup and periodically
	updateStatusBar();
	
	// Update status bar every 10 minutes
	const statusBarInterval = setInterval(updateStatusBar, 10 * 60 * 1000);


	// Register the new command to open welcome page
	const openWelcomeDisposable = vscode.commands.registerCommand('give-me-hours.openWelcome', function () {
		createHoursPanel(context);
	});

	// Register the command to open settings
	const openSettingsDisposable = vscode.commands.registerCommand('give-me-hours.openSettings', function () {
		vscode.commands.executeCommand('workbench.action.openSettings', 'giveMeHours');
	});

	function getConfiguration() {
		const config = vscode.workspace.getConfiguration('giveMeHours');
		return {
			workingDirectory: config.get('workingDirectory', ''),
			duration: config.get('duration', '1h'),
			hoursRounding: config.get('hoursRounding', 0.25),
			projectStartupTime: config.get('projectStartupTime', 0.5),
			words: config.get('words', 50),
			showSummary: config.get('showSummary', true)
		};
	}

	function getWorkingDirectory() {
		const config = getConfiguration();
		
		if (config.workingDirectory) {
			return config.workingDirectory;
		}
		
		// Use the first workspace folder if available
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			return vscode.workspace.workspaceFolders[0].uri.fsPath;
		}
		
		return null; // Return null instead of throwing error
	}

	function isWorkingDirectoryConfigured() {
		const workingDirectory = getWorkingDirectory();
		return workingDirectory !== null;
	}

	function createHoursPanel(context) {
		// Create webview panel
		const panel = vscode.window.createWebviewPanel(
			'giveMeHours',
			'Give Me Hours',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		// Load HTML content
		const htmlPath = path.join(context.extensionPath, 'hours-panel.html');
		const htmlContent = fs.readFileSync(htmlPath, 'utf8');
		panel.webview.html = htmlContent;

		// Handle messages from webview
		panel.webview.onDidReceiveMessage(
			async message => {
				console.log('Received message from webview:', message);
				switch (message.command) {
					case 'refresh':
						await calculateAndSendHours(panel);
						break;
					case 'openSettings':
						await vscode.commands.executeCommand('workbench.action.openSettings', 'giveMeHours');
						break;
					case 'selectFolder':
						console.log('selectFolder command received');
						try {
							const folderUri = await vscode.window.showOpenDialog({
								canSelectFiles: false,
								canSelectFolders: true,
								canSelectMany: false,
								openLabel: 'Select Working Directory'
							});
							
							console.log('Folder dialog result:', folderUri);
							
							if (folderUri && folderUri[0]) {
								const config = vscode.workspace.getConfiguration('giveMeHours');
								await config.update('workingDirectory', folderUri[0].fsPath, vscode.ConfigurationTarget.Global);
								vscode.window.showInformationMessage(`Working directory set to: ${folderUri[0].fsPath}`);
								// Refresh the panel after setting the directory
								await calculateAndSendHours(panel);
							}
						} catch (error) {
							console.error('Error in selectFolder:', error);
							vscode.window.showErrorMessage(`Error selecting folder: ${error.message}`);
						}
						break;
					case 'toggleSummary':
						console.log('toggleSummary command received');
						try {
							const config = vscode.workspace.getConfiguration('giveMeHours');
							const currentValue = config.get('showSummary', true);
							await config.update('showSummary', !currentValue, vscode.ConfigurationTarget.Global);
							// Refresh the panel to show/hide summary
							await calculateAndSendHours(panel);
						} catch (error) {
							console.error('Error in toggleSummary:', error);
							vscode.window.showErrorMessage(`Error toggling summary: ${error.message}`);
						}
						break;
					case 'dateChanged':
						console.log('dateChanged command received:', message.date);
						try {
							currentDate = message.date || 'today';
							// Refresh the panel with the new date
							await calculateAndSendHours(panel);
						} catch (error) {
							console.error('Error in dateChanged:', error);
							vscode.window.showErrorMessage(`Error changing date: ${error.message}`);
						}
						break;
				}
			},
			undefined,
			context.subscriptions
		);

		// Calculate hours on panel creation
		calculateAndSendHours(panel);
	}

	async function calculateAndSendHours(panel) {
		const config = getConfiguration();
		try {
			
			// Check if working directory is configured
			if (!isWorkingDirectoryConfigured()) {
				panel.webview.postMessage({
					type: 'showError',
					error: 'Please configure a working directory. Click the "Select Folder" button above to choose the folder containing your git repositories, or go to Settings to configure it manually.'
				});
				return;
			}

			const workingDirectory = getWorkingDirectory();

			// Create a temporary instance to access parseDuration
			const tempGiveMeHours = new GiveMeHours();
			const duration = tempGiveMeHours.parseDuration(config.duration);
			
			// Create GiveMeHours instance with user settings
			const giveMeHours = new GiveMeHours({
				duration: duration,
				hoursRounding: config.hoursRounding,
				projectStartupTime: config.projectStartupTime,
				showSummary: config.showSummary,
				maxWords: config.words,
				debug: false
			});

			// Get hours for the working directory
			const result = await giveMeHours.getHoursForDirectory(workingDirectory, currentDate);
			
			// Add config info to result
			result.config = config;

			// Send results to webview
			panel.webview.postMessage({
				type: 'showResults',
				data: result
			});

			// Update status bar with new results
			updateStatusBar();

		} catch (error) {
			console.error('Error calculating hours:', error);
			
			// Check if it's a Git user error
			if (error.message.includes('Git global username is not set')) {
				panel.webview.postMessage({
					type: 'showGitUserError',
					error: 'Git global username is not set. Please set it with: git config --global user.name "Your Name"',
					config: config
				});
			} else {
				panel.webview.postMessage({
					type: 'showError',
					error: error.message
				});
			}
		}
	}

	// Add cleanup for the status bar interval
	context.subscriptions.push(
		openWelcomeDisposable, 
		openSettingsDisposable, 
		statusBarItem,
		{ dispose: () => clearInterval(statusBarInterval) }
	);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
