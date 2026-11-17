// Resolving which Harvest project/task a repo's time goes to.
// Order: the repo's saved pick → a suggestion from past Harvest entries → the fallback.

export const PREFERRED_TASK = 'Web Development';

/**
 * @typedef {{ projectId: number, taskId: number, label?: string }} Mapping
 * @typedef {{ projectId: number, projectName: string, clientName: string,
 *   tasks: Array<{ taskId: number, name: string }> }} Assignment
 * @typedef {{ connected: boolean, assignments?: Assignment[], mappings?: Record<string, Mapping>,
 *   suggestions?: Record<string, Mapping>, defaultMapping?: Mapping|null,
 *   previousSends?: Record<string, { at: number, totalHours: number, count: number }>,
 *   harvestUrl?: string, accountName?: string, error?: string }} HarvestState
 */

/** previousSends key for one repo/day. Keep in sync with harvest-controller.js. */
export const cellSendKey = (folder, date) => `cell:${folder}:${date}`;

/** Key a repo by its "owner/repo" remote, falling back to the folder name. */
export const repoKey = (folder, remote) => remote || folder;

/**
 * @param {HarvestState} harvest
 * @param {number} projectId
 */
export const findProject = (harvest, projectId) =>
  (harvest.assignments || []).find((a) => a.projectId === projectId);

/**
 * Still a project/task the user can log time to (projects get archived yearly).
 * @param {HarvestState} harvest
 * @param {Mapping | null | undefined} mapping
 */
export const isValidMapping = (harvest, mapping) => {
  if (!mapping) return false;
  const project = findProject(harvest, mapping.projectId);
  return !!project && project.tasks.some((t) => t.taskId === mapping.taskId);
};

/**
 * @param {HarvestState} harvest
 * @param {string} key
 * @returns {(Mapping & { source: 'saved'|'suggested'|'default' }) | null}
 */
export const resolveMapping = (harvest, key) => {
  const saved = harvest.mappings?.[key];
  if (isValidMapping(harvest, saved)) return { ...saved, source: 'saved' };

  const suggested = harvest.suggestions?.[key.toLowerCase()];
  if (isValidMapping(harvest, suggested)) return { ...suggested, source: 'suggested' };

  if (isValidMapping(harvest, harvest.defaultMapping)) {
    return { ...harvest.defaultMapping, source: 'default' };
  }
  return null;
};

/** "Project › Task" for a mapping, or null if it no longer exists. */
export const mappingLabel = (harvest, mapping) => {
  if (!mapping) return null;
  const project = findProject(harvest, mapping.projectId);
  const task = project?.tasks.find((t) => t.taskId === mapping.taskId);
  return project && task ? `${project.projectName} › ${task.name}` : null;
};

/** The task to pick by default when a project is chosen. */
export const defaultTaskFor = (project) =>
  project.tasks.find((t) => t.name === PREFERRED_TASK) || project.tasks[0];
