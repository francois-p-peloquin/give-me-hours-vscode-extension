import React from 'react';
import { VSCodeDivider } from '@vscode/webview-ui-toolkit/react';

function Configuration({ config }) {
  return (
    <div>
      <h2>Configuration</h2>
      <p>Git User: {config.gitUsername}</p>
      <p>Duration: {config.duration}</p>
      <p>Hours Rounding: {config.hoursRounding}h</p>
      <p>Project Startup Time: {config.projectStartupTime}h</p>
      <p>Min Commit Time: {config.minCommitTime}h</p>
      <p>Directory: {config.workingDirectory || 'Current workspace'}</p>
      <VSCodeDivider />
    </div>
  );
}

export default Configuration;
