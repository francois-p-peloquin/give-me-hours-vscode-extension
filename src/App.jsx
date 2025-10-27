import React, { useState, useEffect } from 'react';
import { VSCodeButton, VSCodeTextField, VSCodeDropdown, VSCodeOption, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import './App.css';
import ResultsTable from './components/ResultsTable';
import Configuration from './components/Configuration';
import { getFormattedLocalDate, createDate, formatToYYYYMMDD } from './utils/dateUtils';

function App() {
  const [date, setDate] = useState(getFormattedLocalDate());
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [onload, setOnload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [display, setDisplay] = useState('Week');
  const [timeFormat, setTimeFormat] = useState('Decimal');
  const [roundHours, setRoundHours] = useState(true);

  const isDateInCurrentWeek = (selectedDate) => {
    if (!data || !data.startOfWeek || !data.endOfWeek) {
      return false;
    }

    const selectedDateStr = formatToYYYYMMDD(createDate(selectedDate));
    const startOfWeekStr = formatToYYYYMMDD(createDate(data.startOfWeek));
    const endOfWeekStr = formatToYYYYMMDD(createDate(data.endOfWeek));

    return selectedDateStr >= startOfWeekStr && selectedDateStr <= endOfWeekStr;
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    window.vscode.postMessage({ command: 'debug', text: `Date changed to ${newDate}` });
    setDate(newDate);
    if (!isDateInCurrentWeek(newDate)) {
      handleRefresh(newDate);
    }
  };

  // Onload send ready command.
  useEffect(() => {
    if (!onload) {
      setOnload(true);
      window.vscode.postMessage({ command: 'ready' });
    }
  }, [onload]);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      switch (message.type) {
        case 'showResults':
          setData({
            ...message.data,
            startOfWeek: createDate(message.data.dateRange.startOfWeek),
            endOfWeek: createDate(message.data.dateRange.endOfWeek)
          });
          setError(null);
          setLoading(false);
          setIsRefreshing(false);
          break;
        case 'showError':
          setError(message.error);
          setData(null);
          setLoading(false);
          setIsRefreshing(false);
          break;
        case 'showGitUserError':
          setError(message.error);
          setData(null);
          setLoading(false);
          setIsRefreshing(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    if (!data || !isDateInCurrentWeek(date)) {
      setLoading(true);
      window.vscode.postMessage({ command: 'refresh', date });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [date]);

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (loading && !data) {
    return <div className="loading">Calculating working hours...</div>;
  }

  if (!data) {
    return null;
  }

  const { results, config } = data;

  const handleRefresh = (refreshDate = date) => {
    if (!data) {
      setLoading(true);
    }
    setIsRefreshing(true);
    window.vscode.postMessage({ command: 'refresh', date: refreshDate });
  };

  return (
    <div>
      <div className="header">
        <h1>Give Me Hours</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <VSCodeDropdown value={display} onChange={e => setDisplay(e.target.value)}>
            <VSCodeOption value="Day">Day</VSCodeOption>
            <VSCodeOption value="Week">Week</VSCodeOption>
          </VSCodeDropdown>
          <VSCodeTextField type="date" value={date} onChange={handleDateChange} />
          <VSCodeDropdown value={timeFormat} onChange={e => setTimeFormat(e.target.value)}>
            <VSCodeOption value="Decimal">Decimal</VSCodeOption>
            <VSCodeOption value="Chrono">Chrono</VSCodeOption>
          </VSCodeDropdown>
          <VSCodeButton onClick={() => handleRefresh(date)} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </VSCodeButton>
          <VSCodeCheckbox checked={roundHours} onChange={e => setRoundHours(e.target.checked)}>Round hours</VSCodeCheckbox>
          <VSCodeButton onClick={() => window.vscode.postMessage({ command: 'openSettings' })}>Open settings</VSCodeButton>
        </div>
      </div>
      {config && <Configuration config={config} />}
      <ResultsTable results={results} date={date} display={display} roundHours={roundHours} config={config} timeFormat={timeFormat} isRefreshing={isRefreshing} />
    </div>
  );
}

export default App;
