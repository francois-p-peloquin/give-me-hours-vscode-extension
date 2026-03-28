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
	let prefetchedData = null;
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
			if (!isWorkingDirectoryConfigured()) {
				statusBarItem.text = "$(clock) Give Me Hours";
				statusBarItem.tooltip = "Click to configure working directory";
				return;
			}

			statusBarItem.text = `$(clock) Give Me Hours`;
			statusBarItem.tooltip = `Take a look at the magical book.`;
			return;
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

	// Prefetch data every 15 minutes
	const prefetchInterval = setInterval(prefetchData, 15 * 60 * 1000);

	// Register the new command to open welcome page
	const openWelcomeDisposable = vscode.commands.registerCommand('give-me-hours.openWelcome', function () {
		createHoursPanel(context);
	});

	// Register the command to open settings
	const openSettingsDisposable = vscode.commands.registerCommand('give-me-hours.openSettings', function () {
		vscode.commands.executeCommand('workbench.action.openSettings', 'giveMeHours');
	});

	async function prefetchData() {
		try {
			prefetchedData = await calculateAndSendHours(null);
		} catch (error) {
			console.error('Error prefetching data:', error);
		}
	}

	// Prefetch data on activation
	prefetchData();


	function getConfiguration() {
		const config = vscode.workspace.getConfiguration('giveMeHours');
		return {
			workingDirectory: config.get('workingDirectory', ''),
			duration: config.get('duration', '1h'),
			hoursRounding: config.get('hoursRounding', 0.25),
			projectStartupTime: config.get('projectStartupTime', 0.5),
			minCommitTime: config.get('minCommitTime', 0.5),
			words: config.get('words', 50),
			timeFormat: config.get('timeFormat', 'decimal')
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
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'build')],
			}
		);

		const buildPath = vscode.Uri.joinPath(context.extensionUri, 'build');
		const indexPath = vscode.Uri.joinPath(buildPath, 'index.html');

		fs.readFile(indexPath.fsPath, 'utf8', (err, html) => {
			if (err) {
				console.error(err);
				return;
			}

			const nonce = getNonce();

			// Replace placeholders in the HTML with the correct resource URIs
			const webviewHtml = html.replace(
				/<link href="\/static\/css\/(main\..*?\.css)" rel="stylesheet">/g,
				(match, p1) => `<link href="${panel.webview.asWebviewUri(vscode.Uri.joinPath(buildPath, 'static', 'css', p1))}" rel="stylesheet">`
			).replace(
				/<script defer="defer" src="\/static\/js\/(main\..*?\.js)"><\/script>/g,
				(match, p1) => `<script defer="defer" nonce="${nonce}" src="${panel.webview.asWebviewUri(vscode.Uri.joinPath(buildPath, 'static', 'js', p1))}"></script>`
			);

			panel.webview.html = webviewHtml;
		});

		// Handle messages from webview
		panel.webview.onDidReceiveMessage(
			async message => {
				console.log('Debug:', message.command, message);
				switch (message.command) {
					case 'ready':
						// Send prefetched data if available
						if (prefetchedData) {
							panel.webview.postMessage({
								type: 'showResults',
								data: prefetchedData
							});
						}
						break;
					case 'refresh':
						currentDate = message.date || 'today';
						// Refresh the panel with the new date
						await calculateAndSendHours(panel);
						break;
					case 'openSettings':
						await vscode.commands.executeCommand('workbench.action.openSettings', 'giveMeHours');
						break;
					case 'selectFolder':
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
					case 'getWorkSummary':
						console.log('getWorkSummary command received:', message.folder, message.date, message.requestId);
						try {
							const summary = await getCommitSummaryForFolder(message.folder, message.date, message.useAISummary);
							panel.webview.postMessage({
								type: 'workSummaryResult',
								summary: summary,
								requestId: message.requestId,
							});
						} catch (error) {
							console.error('Error getting work summary:', error);
							panel.webview.postMessage({
								type: 'workSummaryError',
								error: error.message,
								requestId: message.requestId,
							});
						}
						break;
				}
			},
			undefined,
			context.subscriptions
		);

		// Calculate hours on panel creation
		// const today = new Date();
		// const year = today.getFullYear();
		// const month = String(today.getMonth() + 1).padStart(2, '0');
		// const day = String(today.getDate()).padStart(2, '0');
		// const localDate = `${year}-${month}-${day}`;
		calculateAndSendHours(panel);
	}

	async function getCommitSummaryForFolder(folderName, date, useAISummary) {
		const config = getConfiguration();
		const workingDirectory = getWorkingDirectory();
		const duration = parseDuration(config.duration);
		const maxWords = config.words;

		const giveMeHours = new GiveMeHours({
			duration: duration,
			minCommitTime: config.minCommitTime,
			maxWords: maxWords,
			debug: false
		});

		const folderPath = path.join(workingDirectory, folderName);
		// TODO: Run this through out global dateUtils to ensure consistency.
		const [y, m, d] = date.split('-').map(Number);
		const startOfDay = new Date(y, m - 1, d, 0, 0, 0);
		const endOfDay = new Date(y, m - 1, d, 23, 59, 59);
		const result = giveMeHours.getHoursForRepo(startOfDay, endOfDay, giveMeHours.getGitUsername(), folderPath);

		if (!result.commits || result.commits.length === 0) {
			return 'No activity found for this day.';
		}

		if (useAISummary) {
			const llmSummary = await generateLLMSummary(result.commits, maxWords);
			if (llmSummary) return llmSummary;
		}
		return generateRawLog(result.commits);
	}

	function generateRawLog(commits) {
		const commitsByBranch = commits.reduce((acc, commit) => {
			const branch = commit.branch || 'other';
			if (!acc[branch]) acc[branch] = [];
			acc[branch].push(commit);
			return acc;
		}, {});

		return Object.entries(commitsByBranch).map(([branch, branchCommits]) => {
			const heading = branch.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
			const lines = branchCommits.map(c => `- ${c.message}`).join('\n');
			return `${heading}:\n${lines}`;
		}).join('\n\n');
	}

	async function generateLLMSummary(commits, maxWords) {
		if (!vscode.lm) return null;

		const tokenSource = new vscode.CancellationTokenSource();
		try {
			const models = await vscode.lm.selectChatModels({ family: 'gpt-4o' });
			if (!models || models.length === 0) return null;

			const commitsByBranch = commits.reduce((acc, commit) => {
				const branch = commit.branch || 'other';
				if (!acc[branch]) acc[branch] = [];
				acc[branch].push(commit);
				return acc;
			}, {});

			const commitBlock = Object.entries(commitsByBranch).map(([branch, branchCommits]) => {
				const lines = branchCommits.map(c => `- ${c.message}`).join('\n');
				return `[${branch}]\n${lines}`;
			}).join('\n\n');

			const prompt = `Summarize a developer's work from their git commit messages.

Rules:
- Use each branch name as a markdown heading (## Branch Name), formatted nicely (hyphens/underscores to spaces, title case)
- Under each heading, write bullet points (one per distinct piece of work done)
- Each bullet should be a short, clear phrase — not a full sentence
- Fix typos and remove noise words: "wip", "misc", "stuff", "almost there", "stable", "ditto", "ready"
- Always preserve BugHerd ticket references exactly as they appear (e.g. BH198, BH-198, BH 198, Bugherd #198) — include them in the relevant bullet
- If any commit under a branch references a BugHerd ticket and the branch heading does not already include it, append the ticket ID(s) to the heading (e.g. "## Fix News Thumbnail URL (BH16)")
- Omit merge commits and trivial or duplicate messages
- Write in past tense, professional tone
- Write no more than ${maxWords} words in total across all sections

Commits grouped by branch:
${commitBlock}`;

			const response = await models[0].sendRequest(
				[vscode.LanguageModelChatMessage.User(prompt)],
				{},
				tokenSource.token
			);

			let text = '';
			for await (const chunk of response.text) {
				text += chunk;
			}
			return text.trim() || null;
		} catch (error) {
			console.error('LLM summary error:', error);
			return null;
		} finally {
			tokenSource.dispose();
		}
	}

	function getNonce() {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	function parseDuration(durationStr) {
		const match = durationStr.match(/^([0-9]*\.?[0-9]+)([hms]?)$/);
		if (!match) return 3600; // default to 1 hour

		const value = parseFloat(match[1]);
		const unit = match[2];

		switch (unit) {
				case 'h':
				case '':
						return Math.floor(value * 3600);
				case 'm':
						return Math.floor(value * 60);
				case 's':
						return Math.floor(value);
				default:
						return 3600;
		}
	}

	async function calculateAndSendHours(panel) {
		const config = getConfiguration();
		try {

			// Check if working directory is configured
			if (!isWorkingDirectoryConfigured()) {
				if (panel) {
					panel.webview.postMessage({
						type: 'showError',
						error: 'Please configure a working directory. Click the "Select Folder" button above to choose the folder containing your git repositories, or go to Settings to configure it manually.'
					});
				}
				return;
			}

			const workingDirectory = getWorkingDirectory();

			const duration = parseDuration(config.duration);
			config.duration = String(duration);

			// Create GiveMeHours instance with user settings
			// Always fetch summaries since we now toggle visibility with JS
			const giveMeHours = new GiveMeHours({
				duration: duration,
				minCommitTime: config.minCommitTime,
				showSummary: true, // Always fetch summaries
				maxWords: config.words,
				debug: false
			});

			// Get hours for the working directory
			const result = await giveMeHours.getHoursForDirectory(workingDirectory, currentDate);

			// Add config info to result
			result.config = config;

			// console.log('Calculated hours result:', result, duration);

			prefetchedData = result;

			// Send results to webview
			if (panel) {
				panel.webview.postMessage({
					type: 'showResults',
					data: result
				});
			}

			// Update status bar with new results
			updateStatusBar();

			return result;

		} catch (error) {
			console.error('Error calculating hours:', error);

			// Check if it's a Git user error
			if (error.message.includes('Git global username is not set')) {
				if (panel) {
					panel.webview.postMessage({
						type: 'showGitUserError',
						error: 'Git global username is not set. Please set it with: git config --global user.name "Your Name"',
						config: config
					});
				}
			} else {
				if (panel) {
					panel.webview.postMessage({
						type: 'showError',
						error: error.message
					});
				}
			}
		}
	}

	// Add cleanup for the status bar interval
	context.subscriptions.push(
		openWelcomeDisposable,
		openSettingsDisposable,
		statusBarItem,
		{ dispose: () => clearInterval(statusBarInterval) },
		{ dispose: () => clearInterval(prefetchInterval) }
	);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
