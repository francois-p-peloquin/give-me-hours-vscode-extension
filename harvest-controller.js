// VS Code glue for the Harvest integration: token storage, onboarding, repo mappings,
// and sending time entries. The HTTP client lives in ./harvest.js.

const vscode = require('vscode');
const { HarvestClient, getAccounts } = require('./harvest');

const SECRET_TOKEN = 'giveMeHours.harvestToken';
const STATE_ACCOUNT = 'harvest.account'; // { id, name }
const STATE_SENDS = 'harvest.sends'; // { [selectionKey]: { at, totalHours, count } }
const STATE_SUGGESTIONS = 'harvest.suggestions'; // { accountId, at, map }
const SUGGESTION_TTL_MS = 24 * 60 * 60 * 1000;
const SUGGESTION_LOOKBACK_MONTHS = 6;
const MAX_NOTES_LENGTH = 5000;

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ getSummary: (folder: string, date: string, useAISummary: boolean,
 *   includeSecondary: boolean) => Promise<string> }} deps
 */
function createHarvestController(context, { getSummary }) {
  /** @type {Promise<any[]> | null} */
  let assignmentsPromise = null;
  /** @type {string | null} */
  let harvestUrl = null;

  const settings = () => vscode.workspace.getConfiguration('giveMeHours');

  const clearCaches = () => {
    assignmentsPromise = null;
    harvestUrl = null;
  };

  async function getClient() {
    const token = await context.secrets.get(SECRET_TOKEN);
    const account = context.globalState.get(STATE_ACCOUNT);
    if (!token || !account) return null;
    return new HarvestClient({ token, accountId: account.id });
  }

  /** @param {HarvestClient} client */
  function getAssignments(client) {
    if (!assignmentsPromise) {
      assignmentsPromise = client.getMyAssignments().catch((error) => {
        assignmentsPromise = null; // don't cache failures
        throw error;
      });
    }
    return assignmentsPromise;
  }

  /** @param {HarvestClient} client */
  async function getSuggestions(client) {
    const account = context.globalState.get(STATE_ACCOUNT);
    const cached = context.globalState.get(STATE_SUGGESTIONS);
    if (cached && cached.accountId === account.id && Date.now() - cached.at < SUGGESTION_TTL_MS) {
      return cached.map;
    }
    const from = new Date();
    from.setMonth(from.getMonth() - SUGGESTION_LOOKBACK_MONTHS);
    try {
      const map = await client.suggestProjectsFromHistory(from.toISOString().slice(0, 10));
      await context.globalState.update(STATE_SUGGESTIONS, {
        accountId: account.id,
        at: Date.now(),
        map,
      });
      return map;
    } catch (error) {
      console.error('Harvest suggestions failed:', error);
      return cached?.map || {};
    }
  }

  /** @param {HarvestClient} client */
  async function getHarvestUrl(client) {
    if (!harvestUrl) {
      try {
        const company = await client.getCompany();
        harvestUrl = `https://${company.full_domain}`;
      } catch {
        harvestUrl = 'https://app.harvestapp.com';
      }
    }
    return harvestUrl;
  }

  /**
   * Token prompt with a button that opens Harvest's developer page.
   * @returns {Promise<string|undefined>}
   */
  function askForToken() {
    const developersUrl = 'https://id.getharvest.com/developers';
    const openPage = {
      iconPath: new vscode.ThemeIcon('link-external'),
      tooltip: 'Open Harvest developer page',
    };

    return new Promise((resolve) => {
      const input = vscode.window.createInputBox();
      input.title = 'Connect Harvest (1/3): Personal Access Token';
      input.prompt =
        `Use a Personal Access Token, not an OAuth application. On ${developersUrl}, click ` +
        '"Create new personal access token", then copy "Your Token" (the Account ID isn\'t needed).';
      input.placeholder = 'Paste your Harvest Personal Access Token';
      input.password = true;
      input.ignoreFocusOut = true;
      input.buttons = [openPage];

      let accepted = false;
      input.onDidTriggerButton(() => vscode.env.openExternal(vscode.Uri.parse(developersUrl)));
      input.onDidChangeValue(() => (input.validationMessage = undefined));
      input.onDidAccept(() => {
        const value = input.value.trim();
        if (!value) {
          input.validationMessage = 'Paste the token first.';
          return;
        }
        accepted = true;
        resolve(value);
        input.hide();
      });
      input.onDidHide(() => {
        input.dispose();
        if (!accepted) resolve(undefined);
      });
      input.show();
    });
  }

  /**
   * Onboarding: token → account → fallback project/task.
   * @returns {Promise<boolean>} whether Harvest ended up connected
   */
  async function connect() {
    const token = await askForToken();
    if (!token) return false;

    let accounts;
    try {
      accounts = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Checking Harvest token…' },
        () => getAccounts(token.trim())
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Couldn't connect to Harvest: ${error.message}`);
      return false;
    }
    if (accounts.length === 0) {
      vscode.window.showErrorMessage('That token has no access to a Harvest account.');
      return false;
    }

    let account = accounts[0];
    if (accounts.length > 1) {
      const picked = await vscode.window.showQuickPick(
        accounts.map((a) => ({ label: a.name, account: a })),
        { title: 'Connect Harvest: choose an account', ignoreFocusOut: true }
      );
      if (!picked) return false;
      account = picked.account;
    }

    await context.secrets.store(SECRET_TOKEN, token.trim());
    await context.globalState.update(STATE_ACCOUNT, { id: account.id, name: account.name });
    await context.globalState.update(STATE_SUGGESTIONS, undefined);
    clearCaches();

    await pickDefault({ step: true });
    vscode.window.showInformationMessage(`Connected to Harvest (${account.name}).`);
    return true;
  }

  /**
   * Choose the fallback project/task used by repos without their own pick.
   * @param {{ step?: boolean }} [options]  true when run as part of onboarding (affects titles)
   */
  async function pickDefault({ step = false } = {}) {
    const client = await getClient();
    if (!client) {
      vscode.window.showWarningMessage('Connect Harvest first.');
      return false;
    }

    let assignments;
    try {
      assignments = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Loading Harvest projects…' },
        () => getAssignments(client)
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Couldn't load Harvest projects: ${error.message}`);
      return false;
    }

    const current = settings().get('harvestDefault');
    const project = await vscode.window.showQuickPick(
      assignments.map((a) => ({
        label: a.projectName,
        description: a.clientName,
        detail: current?.projectId === a.projectId ? 'Current fallback' : undefined,
        assignment: a,
      })),
      {
        title: step
          ? 'Connect Harvest (2/3): fallback project'
          : 'Harvest fallback project',
        placeHolder: 'Time for repos without their own project goes here (e.g. Internal 2026)',
        matchOnDescription: true,
        ignoreFocusOut: true,
      }
    );
    if (!project) return false;

    const tasks = project.assignment.tasks;
    let task = tasks[0];
    if (tasks.length > 1) {
      const pickedTask = await vscode.window.showQuickPick(
        tasks.map((t) => ({ label: t.name, task: t })),
        {
          title: step ? 'Connect Harvest (3/3): fallback task' : 'Harvest fallback task',
          placeHolder: `Task within ${project.assignment.projectName} (e.g. Non-Billable Development)`,
          ignoreFocusOut: true,
        }
      );
      if (!pickedTask) return false;
      task = pickedTask.task;
    }

    await settings().update(
      'harvestDefault',
      {
        projectId: project.assignment.projectId,
        taskId: task.taskId,
        label: `${project.assignment.projectName} › ${task.name}`,
      },
      vscode.ConfigurationTarget.Global
    );
    return true;
  }

  async function disconnect() {
    await context.secrets.delete(SECRET_TOKEN);
    await context.globalState.update(STATE_ACCOUNT, undefined);
    await context.globalState.update(STATE_SUGGESTIONS, undefined);
    clearCaches();
    vscode.window.showInformationMessage('Disconnected from Harvest.');
  }

  /** Everything the webview needs to render dropdowns and the confirm dialog. */
  async function getState() {
    const client = await getClient();
    if (!client) return { connected: false };

    try {
      const [assignments, suggestions, url] = await Promise.all([
        getAssignments(client),
        getSuggestions(client),
        getHarvestUrl(client),
      ]);
      return {
        connected: true,
        accountName: context.globalState.get(STATE_ACCOUNT)?.name,
        harvestUrl: url,
        assignments,
        suggestions,
        mappings: settings().get('harvestProjects') || {},
        defaultMapping: settings().get('harvestDefault') || null,
        previousSends: context.globalState.get(STATE_SENDS) || {},
      };
    } catch (error) {
      console.error('Harvest state failed:', error);
      return { connected: error.status !== 401, error: error.message };
    }
  }

  /**
   * Save (or clear, with null) the project/task for one repo.
   * @param {string} key  owner/repo, or folder name for repos without a remote
   * @param {{ projectId: number, taskId: number, label: string } | null} mapping
   */
  async function setMapping(key, mapping) {
    const all = { ...(settings().get('harvestProjects') || {}) };
    if (mapping) all[key] = mapping;
    else delete all[key];
    await settings().update('harvestProjects', all, vscode.ConfigurationTarget.Global);
  }

  /**
   * Create one Harvest time entry per row. Always adds new entries; the webview warns
   * beforehand when the same selection was sent before.
   * @param {{ selectionKey: string, useAISummary: boolean, includeSecondary?: boolean, append?: boolean,
   *   entries: Array<{ folder: string, date: string, hours: number, projectId: number, taskId: number }> }} payload
   * @param {(done: number, total: number) => void} onProgress
   */
  async function send({ selectionKey, useAISummary, includeSecondary, append, entries }, onProgress) {
    const client = await getClient();
    if (!client) throw new Error('Harvest is not connected.');

    let created = 0;
    let createdHours = 0;
    const failed = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      try {
        let notes = await getSummary(entry.folder, entry.date, useAISummary, includeSecondary);
        if (notes.length > MAX_NOTES_LENGTH) notes = `${notes.slice(0, MAX_NOTES_LENGTH - 1)}…`;
        const hours = Math.round(entry.hours * 100) / 100;
        await client.createTimeEntry({
          projectId: entry.projectId,
          taskId: entry.taskId,
          spentDate: entry.date,
          hours,
          notes,
        });
        created++;
        createdHours += hours;
      } catch (error) {
        failed.push({ ...entry, error: error.message });
        if (error.status === 401) {
          // Every remaining request would fail the same way.
          for (const rest of entries.slice(i + 1)) failed.push({ ...rest, error: error.message });
          onProgress(entries.length, entries.length);
          break;
        }
      }
      onProgress(i + 1, entries.length);
    }

    if (created > 0) {
      const sends = { ...(context.globalState.get(STATE_SENDS) || {}) };
      const previous = append ? sends[selectionKey] : null;
      sends[selectionKey] = {
        at: Date.now(),
        totalHours: Math.round(((previous?.totalHours || 0) + createdHours) * 100) / 100,
        count: (previous?.count || 0) + created,
      };
      await context.globalState.update(STATE_SENDS, sends);
    }

    return { created, createdHours: Math.round(createdHours * 100) / 100, failed };
  }

  async function openInHarvest() {
    const client = await getClient();
    const url = client ? await getHarvestUrl(client) : 'https://app.harvestapp.com';
    await vscode.env.openExternal(vscode.Uri.parse(`${url}/time/week`));
  }

  return { connect, disconnect, pickDefault, getState, setMapping, send, openInHarvest };
}

module.exports = { createHarvestController };
