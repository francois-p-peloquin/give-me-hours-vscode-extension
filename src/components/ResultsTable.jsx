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
        const commitDate = commit.commitDate; // Use the new commitDate property
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

const ResultsTable = ({ results, date, display, roundHours, config, timeFormat, folders }) => {
  // Removed hoursCopied state
  const emptyCell = '-';
  const processedResults = useMemo(() => {
    const allProcessed = processResults(results, roundHours, config, timeFormat);
    const weekDates = getWeekDates(date);
    const weekDateStrings = new Set(weekDates.map(d => d.toISOString().slice(0, 10)));
    return allProcessed.filter(result => weekDateStrings.has(result.date));
  }, [results, roundHours, config, timeFormat, date]);

  if (!processedResults || processedResults.length === 0) {
    return <p>No results to display.</p>;
  }

  let headers = [];
  let rows = [];

  const formatDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).replace(',', '<br />')

  const isDateSelected = (displayType, selectedDate, cellDate) => {
    if (!cellDate) return false;
    const year = cellDate.getFullYear();
    const month = String(cellDate.getMonth() + 1).padStart(2, '0');
    const day = String(cellDate.getDate()).padStart(2, '0');
    const formattedCellDate = `${year}-${month}-${day}`;
    if (displayType === 'Day') {
      return formattedCellDate === selectedDate;
    } else if (displayType === 'Week') {
      return formattedCellDate === selectedDate;
    }
    return false;
  };

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

    rows = folders.map(folder => {
      const row = [folder];
      weekDates.forEach(d => {
        const dateString = d.toISOString().slice(0, 10);
        row.push(resultsByFolder[folder]?.[dateString] || emptyCell);
      });
      return row;
    });
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          {headers.map((header, index) => {
            const isDateHeader = index > 0;
            let cellDate = null;
            if (display === 'Day' && isDateHeader) {
              cellDate = new Date(date);
            } else if (display === 'Week' && isDateHeader) {
              const weekDates = getWeekDates(date);
              cellDate = weekDates[index - 1];
            }

            const isSelected = isDateSelected(display, date, cellDate);
            let className = isDateHeader ? 'date-header' : '';
            if (isSelected) {
              className += ' selected-date';
            }

            return (
              <th key={index} className={className} dangerouslySetInnerHTML={{ __html: header }}></th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => {
              let cellDate = null;
              if (display === 'Day' && cellIndex > 0) {
                cellDate = new Date(date);
              } else if (display === 'Week' && cellIndex > 0) {
                const weekDates = getWeekDates(date);
                cellDate = weekDates[cellIndex - 1];
              }

              const isSelected = isDateSelected(display, date, cellDate);
              let tdClassName = cellIndex === 0 ? 'folder-header' : '';
              if (isSelected) {
                tdClassName += ' selected-date';
              }

              return (
                <td className={tdClassName} key={cellIndex}>
                  <div className={cellIndex > 0 ? 'data-cell' : ''}>
                    {cell == emptyCell ? emptyCell : (
                      <>
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
                      </>
                    )}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
        <tr className="total-row">
          <th>Total</th>
          {headers.slice(1).map((header, colIndex) => {
            let totalSecondsForColumn = 0;
            rows.forEach(row => {
              const cell = row[colIndex + 1]; // +1 because row[0] is folder name
              let hoursValue = 0;

              if (cell && cell.hours) {
                if (timeFormat === 'Chrono') {
                  const [hours, minutes] = cell.hours.split(':').map(Number);
                  hoursValue = hours + (minutes / 60);
                } else { // Decimal
                  hoursValue = parseFloat(cell.hours);
                }
              } else if (typeof cell === 'string' && cell !== emptyCell) {
                if (timeFormat === 'Chrono') {
                  const [hours, minutes] = cell.split(':').map(Number);
                  hoursValue = hours + (minutes / 60);
                } else { // Decimal
                  hoursValue = parseFloat(cell);
                }
              }
              totalSecondsForColumn += hoursValue * 3600;
            });

            const formattedTotal = formatTime(totalSecondsForColumn, timeFormat);

            return (
              <th key={colIndex + 1}>
                <div className='data-cell'>
                  <span className='data-cell-hours'>
                    {formattedTotal}
                    <CopyToClipboardButton textToCopy={formattedTotal} />
                  </span>
                </div>
              </th>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
};

export default ResultsTable;
