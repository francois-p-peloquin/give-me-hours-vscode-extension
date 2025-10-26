import React, { useState, useEffect } from 'react';
import { VSCodeButton, VSCodeTextField, VSCodeDropdown, VSCodeOption, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import './App.css';
import { getWeekDates } from './utils/date';
import ResultsTable from './components/ResultsTable';
import Configuration from './components/Configuration';

function App() {
  const getLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(getLocalDate());
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [display, setDisplay] = useState('Week');
  const [timeFormat, setTimeFormat] = useState('Decimal');
  const [roundHours, setRoundHours] = useState(true);
  const [dataCache, setDataCache] = useState({});
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      switch (message.type) {
        case 'showResults':
          const actualStartOfWeek = new Date(message.data.dateRange.startOfWeek);
          const weekStart = actualStartOfWeek.toISOString().slice(0, 10);
          setDataCache(prevCache => ({
            ...prevCache,
            [weekStart]: message.data
          }));
          setData(message.data);
          setFolders(message.data.results.map(result => result.folder));
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

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    const weekDates = getWeekDates(date);
    const weekStart = weekDates[0].toISOString().slice(0, 10);

    if (dataCache[weekStart]) {
      setData(dataCache[weekStart]);
    } else {
      setLoading(true);
      window.vscode.postMessage({ command: 'refresh', weekStart });
    }
  }, [date]);

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

  const handleRefresh = () => {
    setLoading(true);
    const weekDates = getWeekDates(date);
    const weekStart = weekDates[0].toISOString().slice(0, 10);
    window.vscode.postMessage({ command: 'refresh', weekStart });
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
          <VSCodeTextField type="date" value={date} onChange={e => setDate(e.target.value)} />
          <VSCodeDropdown value={timeFormat} onChange={e => setTimeFormat(e.target.value)}>
            <VSCodeOption value="Decimal">Decimal</VSCodeOption>
            <VSCodeOption value="Chrono">Chrono</VSCodeOption>
          </VSCodeDropdown>
          <VSCodeButton onClick={handleRefresh}>Refresh</VSCodeButton>
          <VSCodeCheckbox checked={roundHours} onChange={e => setRoundHours(e.target.checked)}>Round hours</VSCodeCheckbox>
          <VSCodeButton onClick={() => window.vscode.postMessage({ command: 'openSettings' })}>Open settings</VSCodeButton>
        </div>
      </div>
      {config && <Configuration config={config} />}
      <ResultsTable results={results} date={date} display={display} roundHours={roundHours} config={config} timeFormat={timeFormat} folders={folders} />
    </div>
  );
}

export default App;
