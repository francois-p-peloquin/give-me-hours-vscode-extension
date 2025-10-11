import React, { useMemo } from 'react';
import { getWeekDates } from '../utils/date';
import { calculateWorkingHours } from '../utils/hours';
import CopyToClipboardButton from './CopyToClipboardButton';

const processResults = (results, roundHours, config) => {
  if (!results) {
    return [];
  }

  const processed = [];
  for (const folderResult of results) {
    const commitsByDate = {};
    if (folderResult.data.length > 0 && folderResult.data[0].commits) {
      for (const commit of folderResult.data[0].commits) {
        const commitDate = commit.timestamp.slice(0, 10); // Extract YYYY-MM-DD
        if (!commitsByDate[commitDate]) {
          commitsByDate[commitDate] = [];
        }
        commitsByDate[commitDate].push(commit);
      }
    }

    for (const date in commitsByDate) {
      const dailyCommits = commitsByDate[date];
      const totalSeconds = calculateWorkingHours(dailyCommits, roundHours, config);
      const hours = totalSeconds / 3600;
      processed.push({
        folder: folderResult.folder,
        date: date,
        hours: hours.toFixed(2),
      });
    }
  }
  return processed;
};

const ResultsTable = ({ results, date, display, roundHours, config }) => {
  const processedResults = useMemo(() => processResults(results, roundHours, config), [results, roundHours, config]);

  if (!processedResults || processedResults.length === 0) {
    return <p>No results to display.</p>;
  }

  let headers = [];
  let rows = [];

  const formatDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).replace(',', ',<br />')

  if (display === 'Day') {
    const dayResults = processedResults.filter(result => result.date === date);

    if (dayResults.length === 0) {
      return <p>No results for this day.</p>;
    }

    headers = ['Folder', formatDate(new Date(date))];
    rows = dayResults.map(result => [result.folder, result.hours]);

  } else if (display === 'Week') {
    const weekDates = getWeekDates(date);
    headers = ['Folder', ...weekDates.map(d => formatDate(d))];

    const resultsByFolder = processedResults.reduce((acc, result) => {
      const { folder } = result;
      if (!acc[folder]) {
        acc[folder] = {};
      }
      acc[folder][result.date] = result.hours;
      return acc;
    }, {});

    rows = Object.keys(resultsByFolder).map(folder => {
      const row = [folder];
      weekDates.forEach(d => {
        const dateString = d.toISOString().slice(0, 10);
        row.push(resultsByFolder[folder][dateString] || '-');
      });
      return row;
    });
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={index} className={index > 0 ? 'date-header' : ''} dangerouslySetInnerHTML={{__html: header}}></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td className={cellIndex == 0 ? 'folder-header' : ''} key={cellIndex}>
                {cell}
                <CopyToClipboardButton textToCopy={cell.commits} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ResultsTable;
