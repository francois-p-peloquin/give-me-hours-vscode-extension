import React from 'react';
import {
  defaultTaskFor,
  findProject,
  isValidMapping,
  mappingLabel,
  resolveMapping,
} from '../utils/harvestMapping';

/**
 * Per-repo Harvest project (and task) picker shown under the repo name in the table.
 * Changes are saved straight away through `onChange`.
 *
 * @param {{
 *   harvest: import('../utils/harvestMapping').HarvestState,
 *   mappingKey: string,
 *   onChange: (key: string, mapping: { projectId: number, taskId: number, label: string } | null) => void,
 * }} props
 */
const HarvestProjectSelect = ({ harvest, mappingKey, onChange }) => {
  const resolved = resolveMapping(harvest, mappingKey);
  const saved = harvest.mappings?.[mappingKey];
  const savedIsStale = !!saved && !isValidMapping(harvest, saved);

  const projectValue =
    resolved && resolved.source !== 'default' ? String(resolved.projectId) : '';
  const project = projectValue ? findProject(harvest, Number(projectValue)) : null;

  const defaultLabel = mappingLabel(harvest, harvest.defaultMapping);

  // Group projects by client for <optgroup>s.
  const byClient = (harvest.assignments || []).reduce((acc, a) => {
    (acc[a.clientName] = acc[a.clientName] || []).push(a);
    return acc;
  }, /** @type {Record<string, any[]>} */ ({}));

  const save = (projectId, taskId) => {
    const mapping = { projectId, taskId };
    onChange(mappingKey, { ...mapping, label: mappingLabel(harvest, mapping) || '' });
  };

  const handleProjectChange = (e) => {
    if (!e.target.value) {
      onChange(mappingKey, null);
      return;
    }
    const picked = findProject(harvest, Number(e.target.value));
    if (picked) save(picked.projectId, defaultTaskFor(picked).taskId);
  };

  const handleTaskChange = (e) => {
    if (project) save(project.projectId, Number(e.target.value));
  };

  let hint = null;
  if (savedIsStale) hint = 'Saved project is no longer available';
  else if (resolved?.source === 'suggested') hint = 'Suggested from past Harvest entries';

  return (
    <div className="harvest-select">
      <select
        className="harvest-select__control"
        value={projectValue}
        onChange={handleProjectChange}
        title={resolved ? mappingLabel(harvest, resolved) || '' : 'No Harvest project'}
        aria-label={`Harvest project for ${mappingKey}`}
      >
        <option value="">
          {defaultLabel ? `Default: ${defaultLabel}` : 'Default: none set'}
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
      {project && project.tasks.length > 1 && (
        <select
          className="harvest-select__control harvest-select__control--task"
          value={String(resolved?.taskId ?? '')}
          onChange={handleTaskChange}
          aria-label={`Harvest task for ${mappingKey}`}
        >
          {project.tasks.map((t) => (
            <option key={t.taskId} value={String(t.taskId)}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      {hint && <span className="harvest-select__hint">{hint}</span>}
    </div>
  );
};

export default HarvestProjectSelect;
