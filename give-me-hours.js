const { execSync, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');
const Summary = require('./src/utils/summary');

// Never let git wait on a credential prompt during background fetches.
const FETCH_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
const FETCH_TIMEOUT_MS = 30 * 1000;
const FETCH_CONCURRENCY = 8;
const FETCH_MAX_AGE_MS = 5 * 60 * 1000;
/** repo path → { at: ms, error: string|null } for the last fetch attempt (this process) */
const lastFetch = new Map();

/** Repo root containing `dir`, or null if it isn't in a git repo. */
const getGitRoot = (dir) => {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch (e) {
    return null;
  }
};

// Single-quote a value for the shell.
const shellQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

// Inline createDate to avoid ESM import issues when running via Node directly
const createDate = (...args) => {
  if (args.length === 1 && args[0] instanceof Date) return new Date(args[0]);
  if (args.length === 1 && typeof args[0] === 'string') {
    const [year, month, day] = args[0].split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  if (args.length === 0) {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  // @ts-ignore — variadic Date constructor, args are caller-typed
  return new Date(...args);
};

class GiveMeHours {
  constructor(options = {}) {
    this.duration = options.duration || 3600; // 1 hour in seconds
    this.minCommitTime = options.minCommitTime || 0.5;
    this.debug = options.debug || false;
    // Extra git authors (e.g. "site-security-watcher[bot]") whose commits count as your time.
    this.secondaryAuthors = options.secondaryAuthors || [];
    // `git fetch` each repo before scanning, so commits pushed elsewhere are counted.
    this.fetch = options.fetch !== false;
    this.summary = new Summary(options);
  }

  /**
   * Fetch one repo from all its remotes. Fetch only: no pull, no prune, so local
   * branches and files are never touched.
   * @param {string} dir
   * @returns {Promise<{ error: string|null, changed: boolean }>}
   *   `changed` is true when the fetch updated any ref (i.e. there may be new commits).
   */
  fetchRepo(dir) {
    return new Promise((resolve) => {
      execFile(
        'git',
        // --porcelain prints one line per updated ref (nothing when up to date).
        // Not --quiet: it suppresses that output.
        ['fetch', '--all', '--porcelain'],
        { cwd: dir, timeout: FETCH_TIMEOUT_MS, env: FETCH_ENV },
        (error, stdout, stderr) => {
          let message = null;
          if (error) {
            const firstLine = String(stderr || error.message)
              .split('\n')
              .map((l) => l.trim())
              .find(Boolean);
            message = error.killed ? 'Timed out' : firstLine || 'Fetch failed';
          }
          lastFetch.set(dir, { at: Date.now(), error: message });
          resolve({ error: message, changed: String(stdout || '').trim().length > 0 });
        }
      );
    });
  }

  /**
   * The repos to scan: the directory itself if it's a repo root, otherwise its
   * immediate subfolders that are repo roots.
   * @param {string} directoryPath
   * @returns {Array<{ folder: string, dir: string }>}
   */
  findRepos(directoryPath) {
    const repos = [];
    const gitRoot = getGitRoot(directoryPath);
    if (gitRoot && path.resolve(gitRoot) === path.resolve(directoryPath)) {
      repos.push({ folder: path.basename(directoryPath), dir: directoryPath });
      return repos;
    }
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const subDir = path.join(directoryPath, entry.name);
      const subRoot = getGitRoot(subDir);
      if (subRoot && path.resolve(subRoot) === path.resolve(subDir)) {
        repos.push({ folder: entry.name, dir: subDir });
      }
    }
    return repos;
  }

  /**
   * Fetch many repos in parallel. Repos attempted in the last few minutes are skipped
   * unless `force` is set; ones whose last attempt failed are still reported as failed.
   * @param {Array<{ folder: string, dir: string }>} repos
   * @param {{ force?: boolean }} [options]
   */
  async fetchRepos(repos, { force = false } = {}) {
    const due = repos.filter(
      (r) => force || Date.now() - (lastFetch.get(r.dir)?.at || 0) > FETCH_MAX_AGE_MS
    );
    const changed = [];
    let next = 0;
    const worker = async () => {
      while (next < due.length) {
        const repo = due[next++];
        const result = await this.fetchRepo(repo.dir);
        if (result.changed) changed.push(repo.folder);
      }
    };
    await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, due.length) }, worker));

    const failed = repos
      .filter((r) => lastFetch.get(r.dir)?.error)
      .map((r) => ({ folder: r.folder, error: lastFetch.get(r.dir).error }))
      .sort((a, b) => a.folder.localeCompare(b.folder));
    return {
      at: Date.now(),
      repos: repos.length,
      attempted: due.length,
      changed: changed.sort(),
      failed,
    };
  }

  getGitUsername() {
    try {
      return execSync('git config --global user.name', {
        encoding: 'utf8',
      }).trim();
    } catch (error) {
      throw new Error(
        'Git global username is not set. Set it with: git config --global user.name "Your Name"'
      );
    }
  }

  /**
   * @param {Date} fromDate
   * @param {Date} toDate
   * @param {string|string[]} [author]  One author, or several (any of them matches).
   */
  buildGitCommand(fromDate, toDate, author) {
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
    const since = formatDate(fromDate);
    const until = formatDate(toDate);
    const sinceString = ` --since=\"${since}" --until=\"${until}" `;
    const authors = (Array.isArray(author) ? author : [author]).filter(Boolean);
    // Multiple --author flags are OR'd. --fixed-strings so names like "bot[bot]" aren't regexes.
    const authString = authors.length
      ? ` ${authors.map((a) => `--author=${shellQuote(a)}`).join(' ')} --fixed-strings `
      : '';

    // Email goes last so a "|" in the subject can't shift it.
    let cmd = `git log --all ${sinceString} ${authString} --pretty=format:'%H|%at|%an|%ae|%s' --reverse | while IFS='|' read hash timestamp author email subject || [ -n "$hash" ]; do
            branch=$(git branch --contains $hash | grep -v 'detached' | head -1 | sed 's/^[* ]*//')
            echo "$timestamp|$author|$subject|$branch|$email"
        done`;

    return cmd;
  }

  getGitCommits(fromDate, toDate, author) {
    try {
      const cmd = this.buildGitCommand(fromDate, toDate, author);
      if (this.debug) {
        console.log(`Running: ${cmd}`);
      }
      return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      if (this.debug) {
        console.error(`Error executing git command: ${error.message}`);
        throw error; // Re-throw the error in debug mode
      }
      return '';
    }
  }

  calculateWorkingHours(commitsOutput) {
    let totalSeconds = 0;
    let prevTimestamp = null;
    const lines = commitsOutput.split('\n').filter((line) => line.trim());

    if (lines.length === 1) {
      // Only one commit
      totalSeconds += this.minCommitTime * 3600;
    } else {
      // Multiple commits
      for (const line of lines) {
        const [timestamp, author, message] = line.split('|');
        if (!timestamp) continue;

        const currentTimestamp = parseInt(timestamp);

        if (prevTimestamp !== null) {
          const interval = currentTimestamp - prevTimestamp;

          if (this.debug) {
            console.log(`${createDate(prevTimestamp * 1000).toISOString()} ${author} ${message}`);
          }

          // If working time is less than our specified duration
          if (interval <= this.duration) {
            totalSeconds += interval;
          }
          // Otherwise, just add the minimum time worked per commit
          else {
            totalSeconds += this.minCommitTime * 3600;
          }
        }

        prevTimestamp = currentTimestamp;
      }
    }

    return totalSeconds;
  }

  parseBranchName(refs) {
    if (!refs) {
      return null;
    }
    // Example refs: " (HEAD -> feature/new-summary, origin/feature/new-summary)"
    const branchMatch = refs.match(/HEAD -> ([^,)]+)/);
    if (branchMatch && branchMatch[1]) {
      return branchMatch[1];
    }

    return null;
  }

  /**
   * @param {Date} fromDate
   * @param {Date} toDate
   * @param {string|string[]} author  The first author is you; any others are secondary
   *   accounts, and their commits get `isSecondary: true`.
   * @param {string} [repoPath]
   */
  getHoursForRepo(fromDate, toDate, author, repoPath = '.') {
    const originalCwd = process.cwd();

    const defaultReturn = { commits: [] };

    try {
      process.chdir(repoPath);

      // Check if we're in a git repository
      try {
        execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      } catch (error) {
        return defaultReturn;
      }

      const commitsOutput = this.getGitCommits(fromDate, toDate, author);
      if (!commitsOutput) {
        return defaultReturn;
      }

      const primaryAuthor = Array.isArray(author) ? author[0] : author;
      const hasSecondary = Array.isArray(author) && author.length > 1;

      const processedCommits = commitsOutput
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split('|');
          const commitTimestamp = parseInt(parts[0]);
          const commitDate = createDate(commitTimestamp * 1000);
          const year = commitDate.getFullYear();
          const month = String(commitDate.getMonth() + 1).padStart(2, '0');
          const day = String(commitDate.getDate()).padStart(2, '0');
          const formattedCommitDate = `${year}-${month}-${day}`;

          const email = parts.length > 4 ? parts[parts.length - 1] : '';
          return {
            timestamp: commitTimestamp,
            commitDate: formattedCommitDate,
            author: parts[1],
            message: parts[2],
            branch: parts[3],
            // git matched --author against "Name <email>", so check the same string.
            isSecondary: hasSecondary && !`${parts[1]} <${email}>`.includes(primaryAuthor),
          };
        });

      return {
        commits: processedCommits,
      };
    } finally {
      process.chdir(originalCwd);
    }
  }

  getDateRange(dateArg = 'today') {
    const now = createDate();
    let startDate, endDate;
    const dates = [];

    if (dateArg.includes(':')) {
      const [startStr, endStr] = dateArg.split(':');
      startDate = createDate(startStr);
      endDate = createDate(endStr);
    } else {
      switch (dateArg) {
        case 'today':
          startDate = createDate(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = createDate(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
          break;
        case 'yesterday':
          const yesterday = createDate(now);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = createDate(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate()
          );
          endDate = createDate(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate(),
            23,
            59,
            59
          );
          break;
        default:
          // Assume YYYY-MM-DD format
          const dateMatch = dateArg.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateMatch) {
            const year = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]) - 1; // Month is 0-indexed
            const day = parseInt(dateMatch[3]);
            startDate = createDate(year, month, day);
            endDate = createDate(year, month, day, 23, 59, 59);
          } else {
            throw new Error('Invalid date format. Please use YYYY-MM-DD');
          }
      }
    }

    let currentDate = createDate(startDate);
    while (currentDate <= endDate) {
      dates.push(createDate(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      start: startDate
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, ''),
      end: endDate
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, ''),
      dates: dates,
    };
  }

  processDate(arg = 'today') {
    const now = createDate();
    switch (arg) {
      case 'today':
        return createDate(now.getFullYear(), now.getMonth(), now.getDate());
      case 'yesterday':
        const yesterday = createDate(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return createDate(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      default:
        // Assume YYYY-MM-DD format
        const dateMatch = arg.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1]);
          const month = parseInt(dateMatch[2]) - 1; // Month is 0-indexed
          const day = parseInt(dateMatch[3]);
          return createDate(year, month, day);
        } else {
          console.warn('Invalid date format. Please use YYYY-MM-DD');
          return now;
        }
    }
  }

  /**
   * @param {string} directoryPath  A repo, or a folder of repos.
   * @param {string} [dateArg]
   * @param {{ forceFetch?: boolean, fetch?: boolean }} [options]
   *   fetch: override the instance's `fetch` (false = scan local commits only).
   *   forceFetch: ignore the recent-fetch skip.
   */
  async getHoursForDirectory(
    directoryPath,
    dateArg = 'today',
    { forceFetch = false, fetch = this.fetch } = {}
  ) {
    const gitUsername = this.getGitUsername();
    const authors = [gitUsername, ...this.secondaryAuthors];

    const initialDate = this.processDate(dateArg);
    const day = initialDate.getDay();
    const diff = initialDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday

    const startOfWeek = createDate(initialDate);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = createDate(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const results = [];
    let fetchSummary = null;

    try {
      // "owner/repo" from the origin remote, used to remember per-repo Harvest projects.
      const getRemote = (dir) => {
        try {
          const url = execSync('git remote get-url origin', {
            cwd: dir,
            stdio: ['ignore', 'pipe', 'ignore'],
          })
            .toString()
            .trim();
          const match = /[:/]([^/:]+\/[^/]+?)(?:\.git)?\/?$/.exec(url);
          return match ? match[1] : null;
        } catch (e) {
          return null;
        }
      };

      // 1. Find the repos.
      const repos = this.findRepos(directoryPath);

      // 2. Fetch, so commits pushed from elsewhere (teammates, bots, other machines) count.
      if (fetch) {
        fetchSummary = await this.fetchRepos(repos, { force: forceFetch });
      }

      // 3. Scan each repo's commits for the week.
      for (const repo of repos) {
        if (this.debug) {
          console.log(`\nChecking git repository: ${repo.dir}`);
        }
        const result = this.getHoursForRepo(startOfWeek, endOfWeek, authors, repo.dir);
        if (result.commits.length) {
          results.push({ folder: repo.folder, remote: getRemote(repo.dir), data: [result] });
        }
      }
    } catch (error) {
      throw new Error(`Error reading directory ${directoryPath}: ${error.message}`);
    }

    return {
      results,
      dateRange: {
        startOfWeek: `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`,
        endOfWeek: `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getDate()).padStart(2, '0')}`,
      },
      gitUsername,
      fetch: fetchSummary,
    };
  }
}

module.exports = GiveMeHours;

// This block allows the script to be run directly from the command line
if (require.main === module) {
  function parseArgs(argv) {
    const args = argv.slice(2);
    const opts = {
      directories: [],
      date: 'today',
      weekOf: null,
      duration: '1h',
      rounding: 0.25,
      minTime: 0.5,
      words: 50,
      secondaryAuthors: [],
      fetch: true,
      debug: false,
      json: false,
    };

    const helpText = `
Usage: node give-me-hours.js [directory...] [options]

Arguments:
  directory          One or more paths to scan (default: current directory)

Options:
  --date <value>     Show a single day: today, yesterday, or YYYY-MM-DD (default: today)
  --weekOf <value>   Show the full week containing this date: today, yesterday, or YYYY-MM-DD
  --duration <dur>   Max gap between commits to count as same session, e.g. 1h, 30m, 90m (default: 1h)
  --rounding <n>     Round hours up to nearest N, e.g. 0.25 for 15-min increments (default: 0.25)
  --min-time <n>     Minimum hours to count per isolated commit (default: 0.5)
  --words <n>        Max words in commit summary output (default: 50)
  --secondary-authors <list>
                     Comma-separated extra git authors whose commits count as your time,
                     e.g. "site-security-watcher[bot]"
  --no-fetch         Don't git fetch repos before scanning (faster; local commits only)
  --debug            Show git commands and per-commit interval details
  --json             Output raw JSON result instead of formatted text
  --help             Show this help message

Examples:
  node give-me-hours.js ~/Web
  node give-me-hours.js ~/Web/my-project --date yesterday
  node give-me-hours.js ~/Web/my-project --weekOf 2026-03-28
  node give-me-hours.js ~/Web ~/Work --date 2026-03-28 --duration 2h
  node give-me-hours.js ~/Web --rounding 0.5 --min-time 0.25 --debug
`;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--help' || arg === '-h') {
        console.log(helpText);
        process.exit(0);
      } else if (arg === '--debug') {
        opts.debug = true;
      } else if (arg === '--no-fetch') {
        opts.fetch = false;
      } else if (arg === '--json') {
        opts.json = true;
      } else if (arg === '--weekOf' && args[i + 1]) {
        opts.weekOf = args[++i];
      } else if (arg === '--date' && args[i + 1]) {
        opts.date = args[++i];
      } else if (arg === '--duration' && args[i + 1]) {
        opts.duration = args[++i];
      } else if (arg === '--rounding' && args[i + 1]) {
        opts.rounding = parseFloat(args[++i]);
      } else if (arg === '--min-time' && args[i + 1]) {
        opts.minTime = parseFloat(args[++i]);
      } else if (arg === '--words' && args[i + 1]) {
        opts.words = parseInt(args[++i], 10);
      } else if (arg === '--secondary-authors' && args[i + 1]) {
        opts.secondaryAuthors = args[++i]
          .split(/[,\n]/)
          .map((a) => a.trim())
          .filter(Boolean);
      } else if (!arg.startsWith('--')) {
        opts.directories.push(arg);
      } else {
        console.error(`Unknown option: ${arg}. Run with --help for usage.`);
        process.exit(1);
      }
    }

    if (opts.directories.length === 0) {
      opts.directories.push(process.cwd());
    }

    return opts;
  }

  function parseDurationStr(durationStr) {
    const match = durationStr.match(/^([0-9]*\.?[0-9]+)([hms]?)$/);
    if (!match) return 3600;
    const value = parseFloat(match[1]);
    switch (match[2]) {
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

  async function main() {
    const opts = parseArgs(process.argv);
    const durationSeconds = parseDurationStr(opts.duration);
    const isWeekMode = opts.weekOf !== null;
    // getHoursForDirectory always fetches the full week; use weekOf value if set, else date
    const queryDate = isWeekMode ? opts.weekOf : opts.date;

    // Resolve the single-day filter date string (YYYY-MM-DD) when in day mode
    const resolveDateString = (val) => {
      const d =
        val === 'today'
          ? new Date()
          : val === 'yesterday'
            ? new Date(Date.now() - 86400000)
            : new Date(val + 'T00:00:00');
      return d.toISOString().slice(0, 10);
    };
    const filterDate = isWeekMode ? null : resolveDateString(opts.date);

    const giveMeHours = new GiveMeHours({
      duration: durationSeconds,
      minCommitTime: opts.minTime,
      maxWords: opts.words,
      secondaryAuthors: opts.secondaryAuthors,
      fetch: opts.fetch,
      debug: opts.debug,
    });

    try {
      const allResults = [];

      for (const dir of opts.directories) {
        const resolvedDir = path.resolve(dir);
        if (!opts.json) {
          const label = isWeekMode ? `week of ${opts.weekOf}` : opts.date;
          console.log(`\nScanning: ${resolvedDir} (${label})`);
        }
        const result = await giveMeHours.getHoursForDirectory(resolvedDir, queryDate);
        allResults.push({ dir: resolvedDir, result });
      }

      if (opts.json) {
        console.log(
          JSON.stringify(allResults.length === 1 ? allResults[0].result : allResults, null, 2)
        );
        return;
      }

      for (const { dir, result } of allResults) {
        if (allResults.length > 1) {
          console.log(`\n── ${dir} ──`);
        }
        console.log(`Git user : ${result.gitUsername}`);
        if (isWeekMode) {
          console.log(`Week     : ${result.dateRange.startOfWeek} → ${result.dateRange.endOfWeek}`);
        } else {
          console.log(`Date     : ${filterDate}`);
        }
        console.log(
          `Duration : ${opts.duration}  |  Rounding: ${opts.rounding}h  |  Min time: ${opts.minTime}h\n`
        );

        if (result.results.length === 0) {
          console.log('No activity found for this period.');
          continue;
        }

        // Group commits by date for display
        const byDate = {};
        for (const folderResult of result.results) {
          if (folderResult.data.length > 0 && folderResult.data[0].commits) {
            for (const commit of folderResult.data[0].commits) {
              if (!isWeekMode && commit.commitDate !== filterDate) continue;
              const key = `${commit.commitDate}  ${folderResult.folder}`;
              if (!byDate[key]) byDate[key] = [];
              byDate[key].push(commit);
            }
          }
        }

        if (Object.keys(byDate).length === 0) {
          console.log('No activity found for this period.');
          continue;
        }

        let lastDate = null;
        for (const [key, commits] of Object.entries(byDate).sort()) {
          let totalSeconds = giveMeHours.calculateWorkingHours(
            commits.map((c) => `${c.timestamp}|${c.author}|${c.message}|${c.branch}`).join('\n')
          );
          if (opts.rounding > 0) {
            totalSeconds = Math.floor(
              Math.ceil(totalSeconds / 3600 / opts.rounding) * opts.rounding * 3600
            );
          }
          const hours = (totalSeconds / 3600).toFixed(2);
          const currentDate = key.slice(0, 10);
          if (isWeekMode && lastDate && currentDate !== lastDate) {
            console.log('');
          }
          lastDate = currentDate;
          console.log(`${key}  →  ${hours}h`);
          if (opts.debug) {
            commits.forEach((c) => console.log(`    [${c.branch || 'unknown'}] ${c.message}`));
          }
        }
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      if (opts.debug) console.error(error.stack);
      process.exit(1);
    }
  }

  main();
}
