import React, { useEffect, useMemo, useState } from 'react';
import { VSCodeButton, VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';
import { createDate } from '../utils/dateUtils';
import { mappingLabel, repoKey, resolveMapping } from '../utils/harvestMapping';
import { requestFromHost } from '../utils/request';

const formatHours = (h) => h.toFixed(2);
const formatDay = (date) =>
  createDate(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const formatWhen = (ms) =>
  new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * Read-only confirmation before sending time to Harvest. Mapping happens in the table.
 *
 * @param {{
 *   harvest: import('../utils/harvestMapping').HarvestState,
 *   rows: Array<{ folder: string, remote: string|null, date: string, hoursDecimal: number }>,
 *   selectionKey: string,
 *   selectionLabel: string,
 *   includeSecondary: boolean,
 *   onClose: () => void,
 * }} props
 */
const HarvestDialog = ({
  harvest,
  rows,
  selectionKey,
  selectionLabel,
  includeSecondary,
  onClose,
}) => {
  const [phase, setPhase] = useState(/** @type {'confirm'|'sending'|'done'} */ ('confirm'));
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(
    /** @type {{ created: number, createdHours: number, failed: any[] } | null} */ (null)
  );
  const [error, setError] = useState(/** @type {string|null} */ (null));

  // Snapshot the entries when the dialog opens, so a refresh behind it can't change them.
  const [entries] = useState(() =>
    rows.map((row) => ({
      ...row,
      mapping: resolveMapping(harvest, repoKey(row.folder, row.remote)),
    }))
  );

  const groups = useMemo(() => {
    /** @type {Record<string, { folder: string, mapping: any, rows: any[] }>} */
    const byFolder = {};
    for (const entry of entries) {
      byFolder[entry.folder] = byFolder[entry.folder] || {
        folder: entry.folder,
        mapping: entry.mapping,
        rows: [],
      };
      byFolder[entry.folder].rows.push(entry);
    }
    return Object.values(byFolder).map((g) => ({
      ...g,
      rows: g.rows.sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }, [entries]);

  const total = entries.reduce((sum, e) => sum + e.hoursDecimal, 0);
  const unmapped = groups.filter((g) => !g.mapping);
  const previous = harvest.previousSends?.[selectionKey];

  // Esc closes, except mid-send.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && phase !== 'sending') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  const send = async (toSend, append = false) => {
    setPhase('sending');
    setError(null);
    setProgress({ done: 0, total: toSend.length });
    try {
      const reply = await requestFromHost(
        'harvestSend',
        {
          selectionKey,
          includeSecondary,
          append,
          entries: toSend.map((e) => ({
            folder: e.folder,
            remote: e.remote,
            date: e.date,
            hours: e.hoursDecimal,
            projectId: e.mapping.projectId,
            taskId: e.mapping.taskId,
          })),
        },
        {
          resultType: 'harvestSendResult',
          errorType: 'harvestSendError',
          onMessage: (m) => {
            if (m.type === 'harvestProgress') setProgress({ done: m.done, total: m.total });
          },
        }
      );
      setResult((prev) =>
        append && prev
          ? {
              created: prev.created + reply.created,
              createdHours: prev.createdHours + reply.createdHours,
              failed: reply.failed,
            }
          : { created: reply.created, createdHours: reply.createdHours, failed: reply.failed }
      );
    } catch (e) {
      setError(e.message);
    }
    setPhase('done');
  };

  const retryFailed = () => {
    const failedKeys = new Set(result.failed.map((f) => `${f.folder}|${f.date}`));
    send(
      entries.filter((e) => failedKeys.has(`${e.folder}|${e.date}`)),
      true
    );
  };

  return (
    <div className="modal-backdrop" onClick={phase === 'sending' ? undefined : onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="harvest-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="harvest-dialog-title">Add time to Harvest</h2>
        <p className="modal__subtitle">
          {selectionLabel}
          {harvest.accountName ? ` · ${harvest.accountName}` : ''}
        </p>

        {phase === 'confirm' && (
          <>
            {previous && (
              <div className="notice notice--warning">
                You already sent this on {formatWhen(previous.at)} (
                {formatHours(previous.totalHours)}h, {previous.count}{' '}
                {previous.count === 1 ? 'entry' : 'entries'}). Sending again adds new entries.
              </div>
            )}
            {unmapped.length > 0 && (
              <div className="notice notice--error notice--actions">
                <span>
                  No Harvest project for {unmapped.map((g) => g.folder).join(', ')}. Pick one in
                  the table, or choose a fallback for all repos without one.
                </span>
                <VSCodeButton
                  appearance="secondary"
                  onClick={() => {
                    window.vscode.postMessage({ command: 'harvestSetFallback' });
                    onClose();
                  }}
                >
                  Choose fallback
                </VSCodeButton>
              </div>
            )}

            <ul className="harvest-summary">
              {groups.map((g) => (
                <li key={g.folder} className="harvest-summary__repo">
                  <div className="harvest-summary__head">
                    <strong>{g.folder}</strong>
                    <span className="harvest-summary__project">
                      {g.mapping ? mappingLabel(harvest, g.mapping) : 'No project'}
                      {g.mapping?.source === 'default' && (
                        <span className="tag">default</span>
                      )}
                      {g.mapping?.source === 'suggested' && (
                        <span className="tag">suggested</span>
                      )}
                    </span>
                  </div>
                  <ul className="harvest-summary__days">
                    {g.rows.map((r) => (
                      <li key={r.date}>
                        <span>{formatDay(r.date)}</span>
                        <span>{formatHours(r.hoursDecimal)}h</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            <p className="modal__note">
              Notes use each day&rsquo;s commit log, the same text as the Summary button.
            </p>

            <div className="modal__actions">
              <VSCodeButton appearance="secondary" onClick={onClose}>
                Cancel
              </VSCodeButton>
              <VSCodeButton
                className="primary-button"
                disabled={unmapped.length > 0 || entries.length === 0}
                onClick={() => send(entries)}
              >
                Send {formatHours(total)}h to Harvest
              </VSCodeButton>
            </div>
          </>
        )}

        {phase === 'sending' && (
          <div className="modal__progress">
            <VSCodeProgressRing />
            <span>
              Sending {progress.done} of {progress.total}… (writing summaries can take a moment)
            </span>
          </div>
        )}

        {phase === 'done' && (
          <>
            {error && <div className="notice notice--error">{error}</div>}
            {result && result.created > 0 && (
              <div className="notice notice--success">
                Added {result.created} {result.created === 1 ? 'entry' : 'entries'} (
                {formatHours(result.createdHours)}h) to Harvest.
              </div>
            )}
            {result && result.failed.length > 0 && (
              <div className="notice notice--error">
                {result.failed.length} failed:
                <ul>
                  {result.failed.map((f) => (
                    <li key={`${f.folder}|${f.date}`}>
                      {f.folder}, {formatDay(f.date)}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="modal__actions">
              <VSCodeButton
                appearance="secondary"
                onClick={() => window.vscode.postMessage({ command: 'harvestOpen' })}
              >
                Open in Harvest
              </VSCodeButton>
              {result && result.failed.length > 0 && (
                <VSCodeButton appearance="secondary" onClick={retryFailed}>
                  Retry failed
                </VSCodeButton>
              )}
              <VSCodeButton className="primary-button" onClick={onClose}>
                Done
              </VSCodeButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HarvestDialog;
