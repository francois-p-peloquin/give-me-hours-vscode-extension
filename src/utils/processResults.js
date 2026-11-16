import { calculateWorkingHours } from './hours';
import { formatTime } from './rounding';

/**
 * Turn raw per-repo commits into one row per repo per day.
 *
 * @param {any[]} results
 * @param {boolean} roundHours
 * @param {object} config
 * @param {string} timeFormat
 * @returns {Array<{ folder: string, remote: string|null, date: string, hours: string,
 *   hoursDecimal: number, dailyCommits: any[] }>}
 *   `hours` is the display string; `hoursDecimal` the same value as a number.
 */
export const processResults = (results, roundHours, config, timeFormat) => {
  if (!results) {
    return [];
  }

  const processed = [];
  for (const folderResult of results) {
    const commitsByDate = {};
    if (folderResult.data.length > 0 && folderResult.data[0].commits) {
      for (const commit of folderResult.data[0].commits) {
        const commitDate = commit.commitDate;
        if (!commitsByDate[commitDate]) {
          commitsByDate[commitDate] = [];
        }
        commitsByDate[commitDate].push(commit);
      }
    }

    for (const date in commitsByDate) {
      const dailyCommits = commitsByDate[date];
      const totalSeconds = calculateWorkingHours(dailyCommits, roundHours, config);
      processed.push({
        folder: folderResult.folder,
        remote: folderResult.remote || null,
        date: date,
        hours: formatTime(totalSeconds, timeFormat),
        hoursDecimal: Math.round((totalSeconds / 3600) * 100) / 100,
        dailyCommits: dailyCommits,
      });
    }
  }
  return processed;
};
