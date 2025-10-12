import React, { useState, useEffect } from 'react';
import { VSCodeButton, VSCodeTextField, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import { calculateRoundedSeconds, formatTime } from './utils/rounding';
import Configuration from './components/Configuration';
import Accordion from './components/Accordion';
import CopyToClipboardButton from './components/CopyToClipboardButton';
import './App.css';

const vscode = window.acquireVsCodeApi();

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataType, setDataType] = useState('rounded');
  const [timeFormat, setTimeFormat] = useState('decimal');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loadedDates, setLoadedDates] = useState([]);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      switch (message.type) {
        case 'showResults':
          if (message.data.dateRange) {
            const { start, end } = message.data.dateRange;
            const startDate = new Date(start);
            const endDate = new Date(end);
            setLoadedDates(prevDates => [...prevDates, { start: startDate, end: endDate }]);
          }
          setData(message.data);
          setError(null);
          setLoading(false);
          break;
        case 'showError':
          setError(message.error);
          setData(null);
          setLoading(false);
          break;
        case 'showGitUserError':
          setError(message.error);
          setData(null);
          setLoading(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial data
    vscode.postMessage({ command: 'refresh', date });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    vscode.postMessage({ command: 'refresh', date });
  };

  const handleDataTypeChange = (e) => {
    const newDataType = e.target.value;
    setDataType(newDataType);
    vscode.postMessage({ command: 'dataTypeChanged', dataType: newDataType });
  };

  const handleTimeFormatChange = (e) => {
    const newTimeFormat = e.target.value;
    setTimeFormat(newTimeFormat);
    vscode.postMessage({ command: 'timeFormatChanged', timeFormat: newTimeFormat });
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDate(newDate);

    const newDateObj = new Date(newDate);
    const isLoaded = loadedDates.some(range => newDateObj >= range.start && newDateObj <= range.end);

    if (!isLoaded) {
        setLoading(true);
        vscode.postMessage({ command: 'dateChanged', date: newDate });
    }
  };

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (loading) {
    return <div className="loading">Calculating working hours...</div>;
  }

  const { results, config } = data;
  // const useDecimal = timeFormat === 'decimal';
  // const useRounded = dataType === 'rounded';

  // const uniqueDates = Array.from(new Set(results.flatMap(result => result.data.map(dayData => dayData.date)))).sort();

  // const processedRows = results.map(result => {
  //   const folderData = { folder: result.folder };
  //   let folderTotalSeconds = 0;

  //   uniqueDates.forEach(date => {
  //     const dayData = result.data.find(d => d.date === date);
  //     if (dayData) {
  //       const seconds = useRounded ? calculateRoundedSeconds(dayData.seconds, config) : dayData.seconds;
  //       folderTotalSeconds += seconds;
  //       folderData[date] = {
  //         hours: formatTime(seconds, useDecimal),
  //         summary: dayData.summary,
  //         seconds: seconds
  //       };
  //     } else {
  //       folderData[date] = { hours: '0.00', summary: 'No activity', seconds: 0 };
  //     }
  //   });
  //   folderData.totalHours = formatTime(folderTotalSeconds, useDecimal);
  //   folderData.totalSeconds = folderTotalSeconds;
  //   return folderData;
  // });

  // const grandTotalSeconds = processedRows.reduce((acc, row) => acc + row.totalSeconds, 0);

  // const dailyTotals = uniqueDates.map(date => {
  //   let totalSecondsForDay = 0;
  //   processedRows.forEach(row => {
  //     if (row[date]) {
  //       totalSecondsForDay += row[date].seconds;
  //     }
  //   });
  //   return formatTime(totalSecondsForDay, useDecimal);
  // });

  return (
    <div>
      <div className="header">
        <h1>Give Me Hours</h1>
        <pre>{JSON.stringify(results)}</pre>
        {/* <div className="controls">
            <VSCodeTextField type="date" value={date} onChange={handleDateChange} />
            <VSCodeDropdown value={dataType} onChange={handleDataTypeChange}>
                <VSCodeOption value="rounded">Rounded</VSCodeOption>
                <VSCodeOption value="clean">Clean</VSCodeOption>
            </VSCodeDropdown>
            <VSCodeDropdown value={timeFormat} onChange={handleTimeFormatChange}>
                <VSCodeOption value="decimal">Decimal</VSCodeOption>
                <VSCodeOption value="chrono">Chrono</VSCodeOption>
            </VSCodeDropdown>
            <VSCodeButton onClick={handleRefresh}>Refresh</VSCodeButton>
            <VSCodeButton onClick={() => vscode.postMessage({ command: 'openSettings' })}>Settings</VSCodeButton>
        </div> */}
      </div>

      {/* {config && <Configuration config={config} />}

      <table className="data-table">
        <thead>
          <tr>
            <th>Folder</th>
            {uniqueDates.map(d => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {processedRows.map((row, index) => (
            <tr key={index}>
              <td>{row.folder}</td>
              {uniqueDates.map(d => (
                <td key={d}>
                  {row[d].hours}
                  <CopyToClipboardButton textToCopy={row[d].hours} />
                  <br />
                  <CopyToClipboardButton textToCopy={row[d].summary} className="summary-button">Get Work Summary</CopyToClipboardButton>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <th>GRAND TOTAL</th>
            {dailyTotals.map((total, index) => (
              <th key={index}>
                {total}
                <CopyToClipboardButton textToCopy={total} />
              </th>
            ))}
          </tr>
        </tfoot>
      </table> */}
    </div>
  );
}

export default App;
