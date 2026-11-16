import React from 'react';
import { VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
import Accordion from './Accordion';

/**
 * @param {{ harvestDefault?: string | null, config: {
 *   gitUsername: string,
 *   duration: string,
 *   durationDisplay?: string,
 *   hoursRounding: number,
 *   projectStartupTime: number,
 *   minCommitTime: number,
 *   workingDirectory?: string,
 * }}} props
 */
function Configuration({ config, harvestDefault }) {
  return (
    <Accordion title="Configuration">
      <p>Git User: {config.gitUsername}</p>
      <p>Duration: {config.durationDisplay || config.duration}</p>
      <p>Hours Rounding: {config.hoursRounding}h</p>
      <p>Project Startup Time: {config.projectStartupTime}h</p>
      <p>Min Commit Time: {config.minCommitTime}h</p>
      <p>Directory: {config.workingDirectory || 'Current workspace'}</p>
      {harvestDefault && <p>Default Harvest project: {harvestDefault}</p>}
      <VSCodeDivider />
    </Accordion>
  );
}

export default Configuration;
