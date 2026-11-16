// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const GiveMeHours = require('./give-me-hours');
const { createHarvestController } = require('./harvest-controller');
const { formatWorkLog } = require('./work-log');
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
  statusBarItem.text = '$(clock) Give Me Hours';
  statusBarItem.tooltip = 'Click to view your working hours';
  statusBarItem.command = 'give-me-hours.openWelcome';
  statusBarItem.backgroundColor = undefined; // No background color by default
  statusBarItem.show();

  // Function to update status bar with current hours
  async function updateStatusBar() {
    try {
      if (!isWorkingDirectoryConfigured()) {
        statusBarItem.text = '$(clock) Give Me Hours';
        statusBarItem.tooltip = 'Click to configure working directory';
        return;
      }

      statusBarItem.text = `$(clock) Give Me Hours`;
      statusBarItem.tooltip = `Take a look at the magical book.`;
      return;
    } catch (error) {
      statusBarItem.text = '$(clock) Give Me Hours';
      if (error.message.includes('Git global username is not set')) {
        statusBarItem.tooltip = 'Git username not set - Click to configure';
      } else {
        statusBarItem.tooltip = 'Click to view your working hours';
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
  const openWelcomeDisposable = vscode.commands.registerCommand(
    'give-me-hours.openWelcome',
    function () {
      createHoursPanel(context);
    }
  );

  // Register the command to open settings
  const openSettingsDisposable = vscode.commands.registerCommand(
    'give-me-hours.openSettings',
    function () {
      vscode.commands.executeCommand('workbench.action.openSettings', 'giveMeHours');
    }
  );

  // Open Give Me Hours panels, so Harvest state changes reach all of them.
  /** @type {Set<vscode.WebviewPanel>} */
  const panels = new Set();

  const harvest = createHarvestController(context, {
    getSummary: (folder, date, includeSecondary) =>
      getCommitSummaryForFolder(folder, date, includeSecondary),
  });

  async function pushHarvestState(targets = panels) {
    const state = await harvest.getState();
    for (const panel of targets) {
      panel.webview.postMessage({ type: 'harvestState', state });
    }
  }

  const harvestCommandDisposables = [
    vscode.commands.registerCommand('give-me-hours.connectHarvest', async () => {
      await harvest.connect();
      await pushHarvestState();
    }),
    vscode.commands.registerCommand('give-me-hours.disconnectHarvest', async () => {
      await harvest.disconnect();
      await pushHarvestState();
    }),
    vscode.commands.registerCommand('give-me-hours.setHarvestFallback', async () => {
      await harvest.pickDefault();
    }),
    // Mappings and the fallback live in settings; re-sync when they change (from the
    // table dropdowns, the fallback picker, or a hand edit of settings.json).
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('giveMeHours.harvestProjects') ||
        event.affectsConfiguration('giveMeHours.harvestDefault')
      ) {
        pushHarvestState();
      }
    }),
  ];

  async function prefetchData() {
    try {
      prefetchedData = await calculateAndSendHours(null);
    } catch (error) {
      console.error('Error prefetching data:', error);
    }
  }

  // Prefetch data on activation
  prefetchData();

  /** "a, b\nc" → ["a", "b", "c"] */
  function parseAuthorList(value) {
    return String(value || '')
      .split(/[,\n]/)
      .map((a) => a.trim())
      .filter(Boolean);
  }

  function getConfiguration() {
    const config = vscode.workspace.getConfiguration('giveMeHours');
    return {
      workingDirectory: config.get('workingDirectory', ''),
      duration: config.get('duration', '1h'),
      hoursRounding: config.get('hoursRounding', 0.25),
      projectStartupTime: config.get('projectStartupTime', 0.5),
      minCommitTime: config.get('minCommitTime', 0.5),
      words: config.get('words', 300),
      secondaryAuthors: parseAuthorList(config.get('secondaryAuthors', '')),
      fetchBeforeScan: config.get('fetchBeforeScan', true),
      timeFormat: config.get('timeFormat', 'decimal'),
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

    panels.add(panel);
    panel.onDidDispose(() => panels.delete(panel), null, context.subscriptions);

    panel.webview.html = `<!DOCTYPE html><html><head><style>
			body { display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:var(--vscode-editor-background); }
			p { color:#73C9B9; font-size:1.1em; animation:pulse 1.5s ease-in-out infinite; }
			@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
		</style></head><body><p>Loading...</p></body></html>`;

    const buildPath = vscode.Uri.joinPath(context.extensionUri, 'build');
    const indexPath = vscode.Uri.joinPath(buildPath, 'index.html');

    fs.readFile(indexPath.fsPath, 'utf8', (err, html) => {
      if (err) {
        console.error(err);
        return;
      }

      const nonce = getNonce();

      // Replace placeholders in the HTML with the correct resource URIs
      const webviewHtml = html
        .replace(
          /<link href="\/static\/css\/(main\..*?\.css)" rel="stylesheet">/g,
          (match, p1) =>
            `<link href="${panel.webview.asWebviewUri(vscode.Uri.joinPath(buildPath, 'static', 'css', p1))}" rel="stylesheet">`
        )
        .replace(
          /<script defer="defer" src="\/static\/js\/(main\..*?\.js)"><\/script>/g,
          (match, p1) =>
            `<script defer="defer" nonce="${nonce}" src="${panel.webview.asWebviewUri(vscode.Uri.joinPath(buildPath, 'static', 'js', p1))}"></script>`
        );

      panel.webview.html = webviewHtml;
    });

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'copyToClipboard':
            try {
              await vscode.env.clipboard.writeText(String(message.text ?? ''));
              panel.webview.postMessage({ type: 'copyResult', requestId: message.requestId });
            } catch (error) {
              console.error('Error copying to clipboard:', error);
              panel.webview.postMessage({
                type: 'copyError',
                error: error.message,
                requestId: message.requestId,
              });
            }
            break;
          case 'ready':
            // Send prefetched data if available
            if (prefetchedData) {
              panel.webview.postMessage({
                type: 'showResults',
                data: prefetchedData,
              });
            }
            await pushHarvestState([panel]);
            break;
          case 'harvestConnect':
            await vscode.commands.executeCommand('give-me-hours.connectHarvest');
            break;
          case 'harvestSetMapping':
            // onDidChangeConfiguration pushes the new state to every panel.
            await harvest.setMapping(message.key, message.mapping);
            break;
          case 'harvestOpen':
            await harvest.openInHarvest();
            break;
          case 'harvestSend':
            try {
              const result = await harvest.send(message, (done, total) =>
                panel.webview.postMessage({
                  type: 'harvestProgress',
                  requestId: message.requestId,
                  done,
                  total,
                })
              );
              panel.webview.postMessage({
                type: 'harvestSendResult',
                requestId: message.requestId,
                ...result,
              });
            } catch (error) {
              console.error('Error sending to Harvest:', error);
              panel.webview.postMessage({
                type: 'harvestSendError',
                requestId: message.requestId,
                error: error.message,
              });
            }
            await pushHarvestState(); // previousSends changed
            break;
          case 'refresh':
            currentDate = message.date || 'today';
            // Refresh the panel with the new date. The Refresh button forces a fresh fetch.
            await calculateAndSendHours(panel, { forceFetch: !!message.force });
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
                openLabel: 'Select Working Directory',
              });

              if (folderUri && folderUri[0]) {
                const config = vscode.workspace.getConfiguration('giveMeHours');
                await config.update(
                  'workingDirectory',
                  folderUri[0].fsPath,
                  vscode.ConfigurationTarget.Global
                );
                vscode.window.showInformationMessage(
                  `Working directory set to: ${folderUri[0].fsPath}`
                );
                // Refresh the panel after setting the directory
                await calculateAndSendHours(panel);
              }
            } catch (error) {
              console.error('Error in selectFolder:', error);
              vscode.window.showErrorMessage(`Error selecting folder: ${error.message}`);
            }
            break;
          case 'getWorkSummary':
            try {
              const summary = await getCommitSummaryForFolder(
                message.folder,
                message.date,
                message.includeSecondary
              );
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

    // No scan here: the webview requests one ('refresh') as soon as it loads.
  }

  async function getCommitSummaryForFolder(folderName, date, includeSecondary) {
    const config = getConfiguration();
    const workingDirectory = getWorkingDirectory();
    const duration = parseDuration(config.duration);
    const maxWords = config.words;

    const giveMeHours = new GiveMeHours({
      duration: duration,
      minCommitTime: config.minCommitTime,
      maxWords: maxWords,
      debug: false,
    });

    const folderPath = path.join(workingDirectory, folderName);
    // TODO: Run this through out global dateUtils to ensure consistency.
    const [y, m, d] = date.split('-').map(Number);
    const startOfDay = new Date(y, m - 1, d, 0, 0, 0);
    const endOfDay = new Date(y, m - 1, d, 23, 59, 59);
    const result = giveMeHours.getHoursForRepo(
      startOfDay,
      endOfDay,
      includeSecondary
        ? [giveMeHours.getGitUsername(), ...config.secondaryAuthors]
        : giveMeHours.getGitUsername(),
      folderPath
    );

    if (!result.commits || result.commits.length === 0) {
      return 'No activity found for this day.';
    }

    return formatWorkLog(result.commits, { maxWords });
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

  /** The scan in progress, shared by callers asking for the same week and fetch mode. */
  let inflight = null; // { key: string, promise: Promise<any> }
  /** Last fetch result, shown with local results until the next fetch finishes. */
  let lastFetchSummary = null;

  /**
   * Scan the working directory and send results to every open panel, in two steps:
   * 1. Local commits right away (a few seconds).
   * 2. If fetching is on: fetch in the background, then rescan only if a fetch brought
   *    in new commits.
   * @param {vscode.WebviewPanel | null} panel  Gets setup/error messages; results go to all panels.
   * @param {{ forceFetch?: boolean }} [options]
   */
  function calculateAndSendHours(panel, { forceFetch = false } = {}) {
    const key = `${currentDate}|${forceFetch}`;
    if (inflight && inflight.key === key) return inflight.promise;

    const promise = runScan(panel, { forceFetch }).finally(() => {
      if (inflight && inflight.promise === promise) inflight = null;
    });
    inflight = { key, promise };
    return promise;
  }

  async function runScan(panel, { forceFetch }) {
    const config = getConfiguration();
    const scanDate = currentDate;
    try {
      if (!isWorkingDirectoryConfigured()) {
        if (panel) {
          panel.webview.postMessage({
            type: 'showError',
            error:
              'Please configure a working directory. Click the "Select Folder" button above to choose the folder containing your git repositories, or go to Settings to configure it manually.',
          });
        }
        return;
      }

      const workingDirectory = getWorkingDirectory();

      const duration = parseDuration(config.duration);
      const durationDisplay = config.duration; // e.g. "1h" — for display only
      config.duration = String(duration); // seconds string — used by calculateWorkingHours
      config.durationDisplay = durationDisplay;

      const giveMeHours = new GiveMeHours({
        duration: duration,
        minCommitTime: config.minCommitTime,
        showSummary: true,
        // Always fetch secondary accounts too; the webview's checkbox filters them out.
        secondaryAuthors: config.secondaryAuthors,
        maxWords: config.words,
        debug: false,
      });

      /** Send results to all panels, unless the user has moved to another week since. */
      const publish = (result) => {
        if (currentDate !== scanDate) return false;
        result.config = config;
        prefetchedData = result;
        for (const p of panels) p.webview.postMessage({ type: 'showResults', data: result });
        updateStatusBar();
        return true;
      };

      // 1. Local commits, shown right away.
      const local = await giveMeHours.getHoursForDirectory(workingDirectory, scanDate, {
        fetch: false,
      });
      local.fetch = lastFetchSummary;
      local.fetching = config.fetchBeforeScan;
      if (!publish(local) || !config.fetchBeforeScan) return local;

      // 2. Fetch in the background; rescan only if something new came in.
      const summary = await giveMeHours.fetchRepos(giveMeHours.findRepos(workingDirectory), {
        force: forceFetch,
      });
      lastFetchSummary = summary;
      const final = summary.changed.length
        ? await giveMeHours.getHoursForDirectory(workingDirectory, scanDate, { fetch: false })
        : local;
      final.fetch = summary;
      final.fetching = false;
      publish(final);
      return final;
    } catch (error) {
      console.error('Error calculating hours:', error);
      const message = error.message.includes('Git global username is not set')
        ? {
            type: 'showGitUserError',
            error:
              'Git global username is not set. Please set it with: git config --global user.name "Your Name"',
            config: config,
          }
        : { type: 'showError', error: error.message };
      for (const p of panel ? [panel] : panels) p.webview.postMessage(message);
    }
  }

  // Add cleanup for the status bar interval
  context.subscriptions.push(
    openWelcomeDisposable,
    openSettingsDisposable,
    ...harvestCommandDisposables,
    statusBarItem,
    { dispose: () => clearInterval(statusBarInterval) },
    { dispose: () => clearInterval(prefetchInterval) }
  );
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
