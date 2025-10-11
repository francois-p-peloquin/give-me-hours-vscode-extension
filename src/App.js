import React, { useState, useEffect } from 'react';
import { VSCodeButton, VSCodeTextField, VSCodeDropdown, VSCodeOption, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import './App.css';
import ResultsTable from './components/ResultsTable';
import Configuration from './components/Configuration';

const vscode = window.acquireVsCodeApi();

function App() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [display, setDisplay] = useState('Day');
  const [timeFormat, setTimeFormat] = useState('Decimal');
  const [roundHours, setRoundHours] = useState(true);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      switch (message.type) {
        case 'showResults':
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
    vscode.postMessage({ command: 'refresh', date });
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
          <VSCodeButton onClick={() => vscode.postMessage({ command: 'openSettings' })}>Open settings</VSCodeButton>
        </div>
      </div>
      {config && <Configuration config={config} />}
      <ResultsTable results={results} date={date} display={display} roundHours={roundHours} config={config} timeFormat={timeFormat} />
    </div>
  );
}

export default App;
