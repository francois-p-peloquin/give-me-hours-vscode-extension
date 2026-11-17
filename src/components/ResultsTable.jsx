import React, { useMemo } from 'react';
import { getWeekDates, formatToYYYYMMDD, createDate } from '../utils/dateUtils';
import { formatTime } from '../utils/rounding';
import { processResults } from '../utils/processResults';
import { cellSendKey, repoKey } from '../utils/harvestMapping';
import CopyButton from './CopyButton';
import GetWorkSummaryButton from './GetWorkSummaryButton';
import HarvestProjectSelect from './HarvestProjectSelect';
import HarvestCellButton from './HarvestCellButton';

/**
 * @param {{
 *   results: any[],
 *   date: string,
 *   display: string,
 *   roundHours: boolean,
 *   config: object,
 *   timeFormat: string,
 *   isRefreshing: boolean,
 *   includeSecondary: boolean,
 *   harvest: import('../utils/harvestMapping').HarvestState,
 *   onHarvestMappingChange: (key: string, mapping: any) => void,
 *   onAddToHarvest: (selection: { rows: any[], key: string, label: string }) => void,
 * }} props
 */
const ResultsTable = ({
  results,
  date,
  display,
  roundHours,
  config,
  timeFormat,
  isRefreshing,
  includeSecondary,
  harvest,
  onHarvestMappingChange,
  onAddToHarvest,
}) => {
  // Removed hoursCopied state
  const emptyCell = '-';
  const processedResults = useMemo(
    () => processResults(results, roundHours, config, timeFormat, includeSecondary),
    [results, roundHours, config, timeFormat, includeSecondary]
  );
  const remoteByFolder = useMemo(
    () => Object.fromEntries((results || []).map((r) => [r.folder, r.remote || null])),
    [results]
  );

  const canSendToHarvest = !!harvest?.connected && !harvest.unavailable;
  /** Day cells with hours, ready to send. */
  const sendable = (cells) => cells.filter((c) => c && c.hoursDecimal > 0 && !c.isTotal);
  const longDay = (d) =>
    createDate(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const shortMonday = () =>
    createDate(formatToYYYYMMDD(getWeekDates(date)[0])).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });

  /** One repo on one day. */
  const addCell = (cell) =>
    onAddToHarvest({
      rows: [cell],
      key: cellSendKey(cell.folder, cell.date),
      label: `${cell.folder} · ${longDay(cell.date)}`,
    });
  /** Every repo on one day (a column total). */
  const addDay = (cells, day) =>
    onAddToHarvest({ rows: cells, key: `day:${day}`, label: `All repos · ${longDay(day)}` });
  /** One repo, every day of the week (a row total). */
  const addRepoWeek = (cells, folder) => {
    const monday = formatToYYYYMMDD(getWeekDates(date)[0]);
    onAddToHarvest({
      rows: cells,
      key: `repoweek:${folder}:${monday}`,
      label: `${folder} · Week of ${shortMonday()}`,
    });
  };

  if (!isRefreshing && (!processedResults || processedResults.length === 0)) {
    return <p>No results to display.</p>;
  }

  let headers = [];
  let rows = [];

  const formatDate = (d) =>
    d
      .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      .replace(',', '<br />');

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
    const dayResults = processedResults.filter((result) => result.date === date);

    if (!isRefreshing && dayResults.length === 0) {
      return <p>No results for this day.</p>;
    }

    headers = ['Folder', formatDate(createDate(date))];
    rows = dayResults.map((result) => [result.folder, result]);
  } else if (display === 'Week') {
    const weekDates = getWeekDates(date);
    headers = ['Folder', ...weekDates.map((d) => formatDate(d)), 'Totals'];

    const resultsByFolder = processedResults.reduce((acc, result) => {
      const { folder } = result;
      if (!acc[folder]) {
        acc[folder] = {};
      }
      acc[folder][result.date] = result; // Store the entire result object
      return acc;
    }, {});

    rows = Object.keys(resultsByFolder).map((folder) => {
      const row = /** @type {any[]} */ ([folder]);
      let totalSeconds = 0;
      weekDates.forEach((d) => {
        const dateString = d.toISOString().slice(0, 10);
        const cell = resultsByFolder[folder]?.[dateString];
        if (cell && cell.hours) {
          if (timeFormat === 'Chrono') {
            const [hours, minutes] = cell.hours.split(':').map(Number);
            totalSeconds += hours * 3600 + minutes * 60;
          } else {
            // Decimal
            totalSeconds += parseFloat(cell.hours) * 3600;
          }
        }
        row.push(cell || emptyCell);
      });
      row.push({
        hours: formatTime(totalSeconds, timeFormat),
        isTotal: true,
        folder,
        dayCells: sendable(row.slice(1)),
      });
      return row;
    });
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header, index) => {
              const isDateHeader = index > 0;
              let cellDate = null;
              if (display === 'Day' && isDateHeader) {
                cellDate = createDate(date);
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
                <th
                  key={index}
                  className={`${className} ${header === 'Totals' ? 'text-right' : ''}`}
                  dangerouslySetInnerHTML={{ __html: header }}
                ></th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isRefreshing && (
            <tr>
              <td colSpan={headers.length} className="loading-row">
                Refreshing data...
              </td>
            </tr>
          )}
          {!isRefreshing &&
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => {
                  let cellDate = null;
                  if (display === 'Day' && cellIndex > 0) {
                    cellDate = createDate(date);
                  } else if (display === 'Week' && cellIndex > 0) {
                    const weekDates = getWeekDates(date);
                    cellDate = weekDates[cellIndex - 1];
                  }

                  const isSelected = isDateSelected(display, date, cellDate);
                  const isTotalCell = cell.isTotal;
                  const isRowHeader = cellIndex === 0;
                  const CellComponent = isTotalCell || isRowHeader ? 'th' : 'td';
                  let cellClassName = isRowHeader ? 'folder-header' : '';

                  if (isSelected) {
                    cellClassName += ' selected-date';
                  }

                  if (isTotalCell) {
                    cellClassName += ' text-right';
                  }

                  return (
                    <CellComponent className={cellClassName} key={cellIndex}>
                      <div className={cellIndex > 0 ? 'data-cell' : ''}>
                        {cell == emptyCell ? (
                          emptyCell
                        ) : (
                          <>
                            {cell.hours ? (
                              <CopyButton textToCopy={cell.hours} />
                            ) : (
                              <span className="data-cell-hours">{cell}</span>
                            )}
                            {isRowHeader && harvest?.connected && harvest.assignments && (
                              <HarvestProjectSelect
                                harvest={harvest}
                                mappingKey={repoKey(cell, remoteByFolder[cell])}
                                onChange={onHarvestMappingChange}
                              />
                            )}
                            {cellIndex > 0 && !cell.isTotal && (
                              <>
                                <GetWorkSummaryButton
                                  folder={row[0]}
                                  date={cell.date}
                                  includeSecondary={includeSecondary}
                                />
                                {canSendToHarvest && cell.hoursDecimal > 0 && (
                                  <HarvestCellButton
                                    harvest={harvest}
                                    rows={[cell]}
                                    onClick={() => addCell(cell)}
                                  />
                                )}
                              </>
                            )}
                            {cell.isTotal && canSendToHarvest && cell.dayCells?.length > 0 && (
                              <HarvestCellButton
                                harvest={harvest}
                                rows={cell.dayCells}
                                onClick={() => addRepoWeek(cell.dayCells, cell.folder)}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </CellComponent>
                  );
                })}
              </tr>
            ))}
          <tr className="total-row">
            <th>Total</th>
            {headers.slice(1).map((header, colIndex) => {
              let totalSecondsForColumn = 0;
              rows.forEach((row) => {
                const cell = row[colIndex + 1]; // +1 because row[0] is folder name
                let hoursValue = 0;

                if (cell && cell.hours) {
                  if (timeFormat === 'Chrono') {
                    const [hours, minutes] = cell.hours.split(':').map(Number);
                    hoursValue = hours + minutes / 60;
                  } else {
                    // Decimal
                    hoursValue = parseFloat(cell.hours);
                  }
                } else if (typeof cell === 'string' && cell !== emptyCell) {
                  if (timeFormat === 'Chrono') {
                    const [hours, minutes] = cell.split(':').map(Number);
                    hoursValue = hours + minutes / 60;
                  } else {
                    // Decimal
                    hoursValue = parseFloat(cell);
                  }
                }
                totalSecondsForColumn += hoursValue * 3600;
              });

              const formattedTotal = formatTime(totalSecondsForColumn, timeFormat);

              const weekDates = display === 'Week' ? getWeekDates(date) : [];
              const cellDate = display === 'Day' ? createDate(date) : weekDates[colIndex];
              const isSelected = isDateSelected(display, date, cellDate);
              const totalCellClassName = [
                isSelected ? 'selected-date' : '',
                header === 'Totals' ? 'text-right' : '',
              ]
                .filter(Boolean)
                .join(' ');

              // A day column's total sends that day for every repo. (Not the grand
              // total: the header's "Add time to Harvest" covers the whole week.)
              const columnCells = header === 'Totals' ? [] : sendable(rows.map((r) => r[colIndex + 1]));
              // From the cells themselves: `new Date('YYYY-MM-DD')` is UTC midnight,
              // which is the previous day west of UTC.
              const columnDay = columnCells[0]?.date || null;

              return (
                <th key={colIndex + 1} className={totalCellClassName}>
                  <div className="data-cell">
                    <CopyButton textToCopy={formattedTotal} />
                    {canSendToHarvest && columnCells.length > 0 && columnDay && (
                      <HarvestCellButton
                        harvest={harvest}
                        rows={columnCells}
                        onClick={() => addDay(columnCells, columnDay)}
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ResultsTable;
