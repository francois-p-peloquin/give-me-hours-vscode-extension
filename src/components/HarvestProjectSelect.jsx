import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import {
  defaultTaskFor,
  findProject,
  isValidMapping,
  mappingLabel,
  resolveMapping,
} from '../utils/harvestMapping';

const PencilIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 13.59 2.41 15l4.12-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm3.83-2.06L4.47 9.76l8-8 1.77 1.77-8 8z"
    />
  </svg>
);

/**
 * Popup to pick a repo's Harvest project and task. "Use the fallback" clears the saved pick.
 *
 * @param {{
 *   harvest: import('../utils/harvestMapping').HarvestState,
 *   repoName: string,
 *   resolved: ReturnType<typeof resolveMapping>,
 *   onSave: (projectId: number | null, taskId: number | null) => void,
 *   onClose: () => void,
 * }} props
 */
const HarvestProjectDialog = ({ harvest, repoName, resolved, onSave, onClose }) => {
  const [projectId, setProjectId] = useState(
    resolved && resolved.source !== 'default' ? String(resolved.projectId) : ''
  );
  const [taskId, setTaskId] = useState(
    resolved && resolved.source !== 'default' ? String(resolved.taskId) : ''
  );
  const project = projectId ? findProject(harvest, Number(projectId)) : null;
  const defaultLabel = mappingLabel(harvest, harvest.defaultMapping);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Group projects by client for <optgroup>s.
  const byClient = (harvest.assignments || []).reduce((acc, a) => {
    (acc[a.clientName] = acc[a.clientName] || []).push(a);
    return acc;
  }, /** @type {Record<string, any[]>} */ ({}));

  const pickProject = (value) => {
    setProjectId(value);
    const picked = value ? findProject(harvest, Number(value)) : null;
    setTaskId(picked ? String(defaultTaskFor(picked).taskId) : '');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--narrow"
        role="dialog"
        aria-modal="true"
        aria-labelledby="harvest-project-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="harvest-project-title">Harvest project</h2>
        <p className="modal__subtitle">{repoName}</p>

        <label className="modal__field">
          <span>Project</span>
          <select
            className="harvest-select__control"
            value={projectId}
            onChange={(e) => pickProject(e.target.value)}
            autoFocus
          >
            <option value="">
              {defaultLabel ? `Use the fallback: ${defaultLabel}` : 'Use the fallback (none set)'}
            </option>
            {Object.entries(byClient).map(([client, projects]) => (
              <optgroup key={client} label={client || 'No client'}>
                {projects.map((p) => (
                  <option key={p.projectId} value={String(p.projectId)}>
                    {p.projectName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {project && (
          <label className="modal__field">
            <span>Task</span>
            <select
              className="harvest-select__control"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              {project.tasks.map((t) => (
                <option key={t.taskId} value={String(t.taskId)}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {resolved?.source === 'suggested' && (
          <p className="modal__note">
            The current project was suggested from past Harvest entries.
          </p>
        )}

        <div className="modal__actions">
          <VSCodeButton appearance="secondary" onClick={onClose}>
            Cancel
          </VSCodeButton>
          <VSCodeButton
            className="primary-button"
            onClick={() =>
              onSave(project ? project.projectId : null, project ? Number(taskId) : null)
            }
          >
            Save
          </VSCodeButton>
        </div>
      </div>
    </div>
  );
};

/**
 * Per-repo Harvest project, shown under the repo name in the table as one truncated line
 * ("Default » Project » Task") with a pencil that opens the picker popup.
 * Changes are saved through `onChange`.
 *
 * @param {{
 *   harvest: import('../utils/harvestMapping').HarvestState,
 *   mappingKey: string,
 *   repoName: string,
 *   onChange: (key: string, mapping: { projectId: number, taskId: number, label: string } | null) => void,
 * }} props
 */
const HarvestProjectSelect = ({ harvest, mappingKey, repoName, onChange }) => {
  const [editing, setEditing] = useState(false);
  const resolved = resolveMapping(harvest, mappingKey);
  const saved = harvest.mappings?.[mappingKey];
  const savedIsStale = !!saved && !isValidMapping(harvest, saved);

  const project = resolved ? findProject(harvest, resolved.projectId) : null;
  const task = project?.tasks.find((t) => t.taskId === resolved?.taskId);

  /** @type {Array<{ text: string, className?: string }>} */
  const parts = [];
  if (savedIsStale) parts.push({ text: 'Unavailable', className: 'harvest-pick__part--warning' });
  else if (resolved?.source === 'default')
    parts.push({ text: 'Default', className: 'harvest-pick__part--source' });
  else if (resolved?.source === 'suggested')
    parts.push({ text: 'Suggested', className: 'harvest-pick__part--source' });
  if (project && task) parts.push({ text: project.projectName }, { text: task.name });
  if (!project) parts.push({ text: 'No project' });

  let title = project && task ? `${project.projectName} › ${task.name}` : 'No Harvest project';
  if (savedIsStale) title = `Saved project is no longer available. Using: ${title}`;
  else if (resolved?.source === 'default') title = `Fallback project: ${title}`;
  else if (resolved?.source === 'suggested')
    title = `Suggested from past Harvest entries: ${title}`;

  const handleSave = (projectId, taskId) => {
    if (projectId == null) onChange(mappingKey, null);
    else {
      const mapping = { projectId, taskId };
      onChange(mappingKey, { ...mapping, label: mappingLabel(harvest, mapping) || '' });
    }
    setEditing(false);
  };

  return (
    <div className="harvest-pick">
      <span className="harvest-pick__label" title={title}>
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="harvest-pick__sep">»</span>}
            <span className={`harvest-pick__part ${p.className || ''}`}>{p.text}</span>
          </React.Fragment>
        ))}
      </span>
      <button
        type="button"
        className="harvest-pick__edit"
        onClick={() => setEditing(true)}
        title="Change Harvest project"
        aria-label={`Change Harvest project for ${repoName}`}
      >
        <PencilIcon />
      </button>
      {editing &&
        // Portal: inside the table cell it would inherit bold, no-wrap header styles.
        createPortal(
          <HarvestProjectDialog
            harvest={harvest}
            repoName={repoName}
            resolved={savedIsStale ? null : resolved}
            onSave={handleSave}
            onClose={() => setEditing(false)}
          />,
          document.body
        )}
    </div>
  );
};

export default HarvestProjectSelect;
