const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');
const Summary = require('./src/utils/summary');

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

    this.summary = new Summary(options);
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
    const authString = author ? ` --author=\"${author}" ` : '';

    let cmd = `git log --all ${sinceString} ${authString} --pretty=format:'%H|%at|%an|%s' --reverse | while IFS='|' read hash timestamp author subject || [ -n "$hash" ]; do
            branch=$(git branch --contains $hash | grep -v 'detached' | head -1 | sed 's/^[* ]*//')
            echo "$timestamp|$author|$subject|$branch"
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

          return {
            timestamp: commitTimestamp,
            commitDate: formattedCommitDate,
            author: parts[1],
            message: parts[2],
            branch: parts[3],
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

  async getHoursForDirectory(directoryPath, dateArg = 'today') {
    const gitUsername = this.getGitUsername();

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
    const folderData = {};

    try {
      // First, check if the directoryPath itself is a git repository
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

      const gitRoot = getGitRoot(directoryPath);
      const isRepoRoot = gitRoot && path.resolve(gitRoot) === path.resolve(directoryPath);

      if (isRepoRoot) {
        // The target directory is itself a git repo — scan just this repo, not subdirectories
        if (this.debug) {
          console.log(`\nChecking git repository: ${directoryPath}`);
        }
        const result = this.getHoursForRepo(startOfWeek, endOfWeek, gitUsername, directoryPath);
        if (result.commits.length) {
          folderData[path.basename(directoryPath)] = {
            folder: path.basename(directoryPath),
            data: [result],
          };
        }
      } else {
        // The target directory is a container — scan subdirectories for repos
        const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const subDir = path.join(directoryPath, entry.name);
            const subRoot = getGitRoot(subDir);
            if (subRoot && path.resolve(subRoot) === path.resolve(subDir)) {
              if (this.debug) {
                console.log(`\nChecking git repository: ${subDir}`);
              }

              if (!folderData[entry.name]) {
                folderData[entry.name] = { folder: entry.name, data: [] };
              }

              const result = this.getHoursForRepo(startOfWeek, endOfWeek, gitUsername, subDir);

              if (result.commits.length) {
                folderData[entry.name].data.push(result);
              }
            }
          }
        }
      }

      for (const folderName in folderData) {
        if (folderData[folderName].data.length > 0) {
          results.push(folderData[folderName]);
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
