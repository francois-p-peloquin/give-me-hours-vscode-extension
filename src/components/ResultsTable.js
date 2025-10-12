import React, { useMemo } from 'react';
import { getWeekDates } from '../utils/date';
import { calculateWorkingHours } from '../utils/hours';
import { formatTime } from '../utils/rounding';
import CopyToClipboardButton from './CopyToClipboardButton';
import GetWorkSummaryButton from './GetWorkSummaryButton';
// Removed VSCodeLink import as it's no longer needed for copying

const processResults = (results, roundHours, config, timeFormat) => {
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
        hours: formatTime(totalSeconds, timeFormat),
        dailyCommits: dailyCommits, // Add dailyCommits here
      });
    }
  }
  return processed;
};

const ResultsTable = ({ results, date, display, roundHours, config, timeFormat }) => {
  // Removed hoursCopied state
  const emptyCell = '-';
  const processedResults = useMemo(() => processResults(results, roundHours, config, timeFormat), [results, roundHours, config, timeFormat]);

  if (!processedResults || processedResults.length === 0) {
    return <p>No results to display.</p>;
  }

  let headers = [];
  let rows = [];

  const formatDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).replace(',', '<br />')

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
      acc[folder][result.date] = result; // Store the entire result object
      return acc;
    }, {});

    rows = Object.keys(resultsByFolder).map(folder => {
      const row = [folder];
      weekDates.forEach(d => {
        const dateString = d.toISOString().slice(0, 10);
        row.push(resultsByFolder[folder][dateString] || emptyCell);
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
                {cell == emptyCell ? emptyCell : (
                  <div className={cellIndex > 0 ? 'data-cell' : ''}>
                    <span className='data-cell-hours'>
                      {cell.hours ? (
                        <>
                          {cell.hours}
                          <CopyToClipboardButton textToCopy={cell.hours} />
                        </>
                      ) : (cell)}
                    </span>
                    {cellIndex > 0 && (
                      <>
                        <GetWorkSummaryButton folder={row[0]} date={cell.date} />
                      </>
                    )}
                  </div>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ResultsTable;
