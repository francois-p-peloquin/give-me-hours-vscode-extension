import React, { useState, useEffect } from 'react';
import { VSCodeButton, VSCodeTextField, VSCodeDropdown, VSCodeOption, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import './App.css';
import ResultsTable from './components/ResultsTable';
import Configuration from './components/Configuration';
import { getFormattedLocalDate, createDate } from './utils/dateUtils';

function App() {
  const [date, setDate] = useState(getFormattedLocalDate());
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [display, setDisplay] = useState('Week');
  const [timeFormat, setTimeFormat] = useState('Decimal');
  const [roundHours, setRoundHours] = useState(true);

  const isDateInCurrentWeek = (selectedDate) => {
    if (!data || !data.startOfWeek || !data.endOfWeek) {
      return false;
    }

    const formatToYYYYMMDD = (dateObj) => {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const selectedDateStr = formatToYYYYMMDD(createDate(selectedDate));
    const startOfWeekStr = formatToYYYYMMDD(data.startOfWeek);
    const endOfWeekStr = formatToYYYYMMDD(data.endOfWeek);

    return selectedDateStr >= startOfWeekStr && selectedDateStr <= endOfWeekStr;
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDate(newDate);
    if (!isDateInCurrentWeek(newDate)) {
      handleRefresh(newDate);
    }
  };

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

    window.vscode.postMessage({ command: 'refresh', date });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (loading) {
    return <div className="loading">Calculating working hours...</div>;
  }

  if (!data) {
    return null;
  }

  const { results, config } = data;

  const handleRefresh = (refreshDate = date) => {
    setLoading(true);
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
          <VSCodeButton onClick={() => handleRefresh(date)}>Refresh</VSCodeButton>
          <VSCodeCheckbox checked={roundHours} onChange={e => setRoundHours(e.target.checked)}>Round hours</VSCodeCheckbox>
          <VSCodeButton onClick={() => window.vscode.postMessage({ command: 'openSettings' })}>Open settings</VSCodeButton>
        </div>
      </div>
      {config && <Configuration config={config} />}
      <ResultsTable results={results} date={date} display={display} roundHours={roundHours} config={config} timeFormat={timeFormat} />
    </div>
  );
}

export default App;
