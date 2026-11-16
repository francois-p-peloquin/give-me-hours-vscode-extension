import React, { useState, useEffect, useMemo } from 'react';
import {
  VSCodeButton,
  VSCodeTextField,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeCheckbox,
} from '@vscode/webview-ui-toolkit/react';
import './App.css';
import ResultsTable from './components/ResultsTable';
import Configuration from './components/Configuration';
import HarvestDialog from './components/HarvestDialog';
import {
  getFormattedLocalDate,
  createDate,
  formatToYYYYMMDD,
  getWeekDates,
} from './utils/dateUtils';
import { processResults } from './utils/processResults';

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
  const [useAISummary, setUseAISummary] = useState(true);
  const [harvest, setHarvest] = useState(
    /** @type {import('./utils/harvestMapping').HarvestState} */ ({ connected: false })
  );
  const [harvestDialogOpen, setHarvestDialogOpen] = useState(false);

  // Harvest state is pushed by the host on load and whenever it changes.
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'harvestState') setHarvest(event.data.state);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleMappingChange = (key, mapping) => {
    // Optimistic update; the host persists it to settings and pushes fresh state.
    setHarvest((h) => {
      const mappings = { ...(h.mappings || {}) };
      if (mapping) mappings[key] = mapping;
      else delete mappings[key];
      return { ...h, mappings };
    });
    window.vscode.postMessage({ command: 'harvestSetMapping', key, mapping });
  };

  const processedResults = useMemo(
    () => (data ? processResults(data.results, roundHours, data.config, timeFormat) : []),
    [data, roundHours, timeFormat]
  );

  // What "Add time to Harvest" sends: the selected day, or every day of the selected week.
  const selection = useMemo(() => {
    const dates =
      display === 'Day' ? [date] : getWeekDates(date).map((d) => formatToYYYYMMDD(d));
    const label =
      display === 'Day'
        ? createDate(date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })
        : `Week of ${createDate(dates[0]).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
          })}`;
    return {
      key: display === 'Day' ? `day:${date}` : `week:${dates[0]}`,
      label,
      rows: processedResults.filter((r) => dates.includes(r.date) && r.hoursDecimal > 0),
    };
  }, [display, date, processedResults]);

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
            endOfWeek: createDate(message.data.dateRange.endOfWeek),
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
    return <div className="loading">Loading...</div>;
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
          <VSCodeDropdown value={display} onChange={(e) => setDisplay(e.target.value)}>
            <VSCodeOption value="Day">Day</VSCodeOption>
            <VSCodeOption value="Week">Week</VSCodeOption>
          </VSCodeDropdown>
          <VSCodeTextField type="date" value={date} onChange={handleDateChange} />
          <VSCodeDropdown value={timeFormat} onChange={(e) => setTimeFormat(e.target.value)}>
            <VSCodeOption value="Decimal">Decimal</VSCodeOption>
            <VSCodeOption value="Chrono">Chrono</VSCodeOption>
          </VSCodeDropdown>
          <VSCodeButton onClick={() => handleRefresh(date)} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </VSCodeButton>
          <VSCodeCheckbox checked={roundHours} onChange={(e) => setRoundHours(e.target.checked)}>
            Round hours
          </VSCodeCheckbox>
          <VSCodeCheckbox
            checked={useAISummary}
            onChange={(e) => setUseAISummary(e.target.checked)}
          >
            Use AI commit summary
          </VSCodeCheckbox>
          <VSCodeButton onClick={() => window.vscode.postMessage({ command: 'openSettings' })}>
            Open settings
          </VSCodeButton>
          {harvest.connected ? (
            <VSCodeButton
              className="primary-button"
              disabled={selection.rows.length === 0 || isRefreshing}
              title={
                selection.rows.length === 0
                  ? `No hours for this ${display.toLowerCase()}`
                  : `Send ${selection.label.toLowerCase()} to Harvest`
              }
              onClick={() => setHarvestDialogOpen(true)}
            >
              Add time to Harvest
            </VSCodeButton>
          ) : (
            <VSCodeButton
              className="primary-button"
              onClick={() => window.vscode.postMessage({ command: 'harvestConnect' })}
            >
              Connect Harvest
            </VSCodeButton>
          )}
        </div>
        {harvest.error && <div className="notice notice--error">Harvest: {harvest.error}</div>}
      </div>
      {config && <Configuration config={config} />}
      <ResultsTable
        results={results}
        date={date}
        display={display}
        roundHours={roundHours}
        config={config}
        timeFormat={timeFormat}
        isRefreshing={isRefreshing}
        useAISummary={useAISummary}
        harvest={harvest}
        onHarvestMappingChange={handleMappingChange}
      />
      {harvestDialogOpen && (
        <HarvestDialog
          harvest={harvest}
          rows={selection.rows}
          selectionKey={selection.key}
          selectionLabel={selection.label}
          useAISummary={useAISummary}
          onClose={() => setHarvestDialogOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
