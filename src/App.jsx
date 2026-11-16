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
import { mappingLabel } from './utils/harvestMapping';

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
  const [includeSecondary, setIncludeSecondary] = useState(true);
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
    () =>
      data
        ? processResults(data.results, roundHours, data.config, timeFormat, includeSecondary)
        : [],
    [data, roundHours, timeFormat, includeSecondary]
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

  /** @param {string} [refreshDate] @param {boolean} [force] re-fetch every repo */
  const handleRefresh = (refreshDate = date, force = false) => {
    if (!data) {
      setLoading(true);
    }
    setIsRefreshing(true);
    window.vscode.postMessage({ command: 'refresh', date: refreshDate, force });
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
          <VSCodeButton
            onClick={() => handleRefresh(date, true)}
            disabled={isRefreshing}
            title="Fetch every repo from its remotes, then recalculate"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </VSCodeButton>
          <VSCodeCheckbox checked={roundHours} onChange={(e) => setRoundHours(e.target.checked)}>
            Round hours
          </VSCodeCheckbox>
          {config?.secondaryAuthors?.length > 0 && (
            <VSCodeCheckbox
              checked={includeSecondary}
              onChange={(e) => setIncludeSecondary(e.target.checked)}
              title={`Count commits by: ${config.secondaryAuthors.join(', ')}`}
            >
              Include secondary accounts
            </VSCodeCheckbox>
          )}
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
        {data.fetch?.failed?.length > 0 && (
          <div
            className="fetch-note"
            title={data.fetch.failed.map((f) => `${f.folder}: ${f.error}`).join('\n')}
          >
            Couldn&rsquo;t fetch {data.fetch.failed.length}{' '}
            {data.fetch.failed.length === 1 ? 'repo' : 'repos'} (showing local commits only):{' '}
            {data.fetch.failed.map((f) => f.folder).join(', ')}
          </div>
        )}
      </div>
      {config && (
        <Configuration
          config={{ ...config, gitUsername: data.gitUsername }}
          harvestDefault={
            harvest.connected && harvest.defaultMapping
              ? mappingLabel(harvest, harvest.defaultMapping) || harvest.defaultMapping.label
              : null
          }
        />
      )}
      <ResultsTable
        results={results}
        date={date}
        display={display}
        roundHours={roundHours}
        config={config}
        timeFormat={timeFormat}
        isRefreshing={isRefreshing}
        includeSecondary={includeSecondary}
        harvest={harvest}
        onHarvestMappingChange={handleMappingChange}
      />
      {harvestDialogOpen && (
        <HarvestDialog
          harvest={harvest}
          rows={selection.rows}
          selectionKey={selection.key}
          selectionLabel={selection.label}
          includeSecondary={includeSecondary}
          onClose={() => setHarvestDialogOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
