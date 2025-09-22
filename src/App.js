import React, { useState, useEffect } from 'react';
import { VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeButton, VSCodeTextField, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import { calculateRoundedSeconds, formatTime } from './utils/rounding';
import Configuration from './components/Configuration';
import './App.css';

const vscode = window.acquireVsCodeApi();

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [dataType, setDataType] = useState('rounded');
  const [timeFormat, setTimeFormat] = useState('decimal');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      switch (message.type) {
        case 'showResults':
          setData(message.data);
          setError(null);
          break;
        case 'showError':
          setError(message.error);
          setData(null);
          break;
        case 'showGitUserError':
          setError(message.error);
          setData(null);
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
  }, [date]);

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
    vscode.postMessage({ command: 'dateChanged', date: newDate });
  };

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!data) {
    return <div className="loading">Calculating working hours...</div>;
  }

  const { results, config } = data;
  const useDecimal = timeFormat === 'decimal';
  const useRounded = dataType === 'rounded';

  let totalSeconds = 0;
  const rows = results.flatMap(result => {
    return result.data.map(dayData => {
      const seconds = useRounded ? calculateRoundedSeconds(dayData.seconds, config) : dayData.seconds;
      totalSeconds += seconds;
      return {
        folder: `${result.folder} (${dayData.date})`,
        hours: formatTime(seconds, useDecimal),
        summary: dayData.summary,
        seconds: seconds
      };
    });
  });

  return (
    <div>
      <div className="header">
        <h1>Give Me Hours</h1>
        <div className="controls">
            <VSCodeTextField type="text" value={date} onChange={handleDateChange} />
            <VSCodeDropdown value={dataType} onChange={handleDataTypeChange}>
                <VSCodeOption value="rounded">Rounded</VSCodeOption>
                <VSCodeOption value="clean">Clean</VSCodeOption>
            </VSCodeDropdown>
            <VSCodeDropdown value={timeFormat} onChange={handleTimeFormatChange}>
                <VSCodeOption value="decimal">Decimal</VSCodeOption>
                <VSCodeOption value="chrono">Chrono</VSCodeOption>
            </VSCodeDropdown>
            <VSCodeButton onClick={() => vscode.postMessage({ command: 'refresh', date })}>Refresh</VSCodeButton>
            <VSCodeButton onClick={() => vscode.postMessage({ command: 'openSettings' })}>Settings</VSCodeButton>
        </div>
      </div>

      {config && <Configuration config={config} />}

      <VSCodeDataGrid gridTemplateColumns="2fr 1fr 3fr">
        <VSCodeDataGridRow rowType="header">
          <VSCodeDataGridCell cellType="columnheader">Repository</VSCodeDataGridCell>
          <VSCodeDataGridCell cellType="columnheader">Hours Worked</VSCodeDataGridCell>
          <VSCodeDataGridCell cellType="columnheader">Summary</VSCodeDataGridCell>
        </VSCodeDataGridRow>
        {rows.map((row, index) => (
          <VSCodeDataGridRow key={index}>
            <VSCodeDataGridCell>{row.folder}</VSCodeDataGridCell>
            <VSCodeDataGridCell>{row.hours}</VSCodeDataGridCell>
            <VSCodeDataGridCell>{row.summary}</VSCodeDataGridCell>
          </VSCodeDataGridRow>
        ))}
        <VSCodeDataGridRow>
            <VSCodeDataGridCell>TOTAL</VSCodeDataGridCell>
            <VSCodeDataGridCell>{formatTime(totalSeconds, useDecimal)}</VSCodeDataGridCell>
            <VSCodeDataGridCell></VSCodeDataGridCell>
        </VSCodeDataGridRow>
      </VSCodeDataGrid>
    </div>
  );
}

export default App;
