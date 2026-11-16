// Minimal Harvest API v2 client (https://help.getharvest.com/api-v2/).
// Runs in the extension host; uses Node's global fetch.

const ID_URL = 'https://id.getharvest.com/api/v2';
const API_URL = 'https://api.harvestapp.com/v2';
const USER_AGENT =
  'Give Me Hours (https://github.com/francois-p-peloquin/give-me-hours-vscode-extension)';

class HarvestError extends Error {
  /**
   * @param {string} message
   * @param {number} [status]
   */
  constructor(message, status) {
    super(message);
    this.name = 'HarvestError';
    this.status = status;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} url
 * @param {{ method?: string, token: string, accountId?: string|number, body?: object }} options
 * @param {boolean} [retried]
 */
async function httpJson(url, { method = 'GET', token, accountId, body }, retried = false) {
  /** @type {Record<string, string>} */
  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  };
  if (accountId) headers['Harvest-Account-Id'] = String(accountId);
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });

  if (res.status === 429 && !retried) {
    const waitSeconds = Number(res.headers.get('Retry-After')) || 15;
    await sleep(waitSeconds * 1000);
    return httpJson(url, { method, token, accountId, body }, true);
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new HarvestError(
        'Harvest rejected the token. Reconnect with "Give Me Hours: Configure Harvest".',
        401
      );
    }
    let detail = '';
    try {
      const json = await res.json();
      detail = json.error_description || json.message || json.error || '';
    } catch {
      // Body wasn't JSON; the status code is all we have.
    }
    throw new HarvestError(
      `Harvest request failed (${res.status})${detail ? `: ${detail}` : ''}`,
      res.status
    );
  }

  return res.status === 204 ? null : res.json();
}

/**
 * Harvest accounts the token can access (Forecast accounts filtered out).
 * @param {string} token
 * @returns {Promise<Array<{ id: number, name: string }>>}
 */
async function getAccounts(token) {
  const json = await httpJson(`${ID_URL}/accounts`, { token });
  return (json.accounts || []).filter((a) => a.product === 'harvest');
}

/**
 * Extract "owner/repo" from a GitHub URL (issue, PR, or repo link).
 * @param {string} url
 * @returns {string|null}
 */
function githubRepoFromUrl(url) {
  const match = /github\.com\/([^/\s]+\/[^/\s#?]+)/i.exec(url || '');
  return match ? match[1].replace(/\.git$/, '').toLowerCase() : null;
}

class HarvestClient {
  /**
   * @param {{ token: string, accountId: string|number }} options
   */
  constructor({ token, accountId }) {
    this.token = token;
    this.accountId = accountId;
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {object} [body]
   */
  request(method, path, body) {
    return httpJson(`${API_URL}${path}`, {
      method,
      token: this.token,
      accountId: this.accountId,
      body,
    });
  }

  /**
   * Fetch every page of a paginated list endpoint.
   * @param {string} path
   * @param {string} key  Response property holding the records.
   */
  async getAll(path, key) {
    const records = [];
    let page = 1;
    for (;;) {
      const sep = path.includes('?') ? '&' : '?';
      const json = await this.request('GET', `${path}${sep}page=${page}&per_page=100`);
      records.push(...(json[key] || []));
      if (!json.next_page) break;
      page = json.next_page;
    }
    return records;
  }

  getMe() {
    return this.request('GET', '/users/me');
  }

  getCompany() {
    return this.request('GET', '/company');
  }

  /**
   * Active projects (and their active tasks) the current user can log time to.
   * @returns {Promise<Array<{ projectId: number, projectName: string, clientName: string,
   *   tasks: Array<{ taskId: number, name: string }> }>>}
   */
  async getMyAssignments() {
    const raw = await this.getAll(
      '/users/me/project_assignments?is_active=true',
      'project_assignments'
    );
    return raw
      .filter((a) => a.is_active !== false)
      .map((a) => ({
        projectId: a.project.id,
        projectName: a.project.name,
        clientName: a.client?.name || '',
        tasks: (a.task_assignments || [])
          .filter((t) => t.is_active !== false)
          .map((t) => ({ taskId: t.task.id, name: t.task.name }))
          .sort((x, y) => x.name.localeCompare(y.name)),
      }))
      .filter((a) => a.tasks.length > 0)
      .sort(
        (x, y) =>
          x.clientName.localeCompare(y.clientName) || x.projectName.localeCompare(y.projectName)
      );
  }

  /**
   * Suggest a project/task per GitHub repo from the current user's past time entries that
   * were started from a GitHub issue (Harvest stores the issue URL as external_reference).
   * The most recent entry wins, so a newer contract ("SLA 2026") beats an older one.
   * @param {string} fromDate  YYYY-MM-DD
   * @returns {Promise<Record<string, { projectId: number, taskId: number }>>}  keyed by lowercased owner/repo
   */
  async suggestProjectsFromHistory(fromDate) {
    const me = await this.getMe();
    const entries = await this.getAll(
      `/time_entries?user_id=${me.id}&from=${fromDate}`,
      'time_entries'
    );
    entries.sort((a, b) => a.spent_date.localeCompare(b.spent_date));

    /** @type {Record<string, { projectId: number, taskId: number }>} */
    const suggestions = {};
    for (const entry of entries) {
      const repo = githubRepoFromUrl(entry.external_reference?.permalink);
      if (repo && entry.project && entry.task) {
        suggestions[repo] = { projectId: entry.project.id, taskId: entry.task.id };
      }
    }
    return suggestions;
  }

  /**
   * @param {{ projectId: number, taskId: number, spentDate: string, hours: number, notes?: string }} entry
   */
  createTimeEntry({ projectId, taskId, spentDate, hours, notes }) {
    return this.request('POST', '/time_entries', {
      project_id: projectId,
      task_id: taskId,
      spent_date: spentDate,
      hours,
      notes,
    });
  }
}

module.exports = { HarvestClient, HarvestError, getAccounts, githubRepoFromUrl };
