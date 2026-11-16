import React from 'react';
import CopyButton from './CopyButton';

/**
 * Ask the extension for a work summary and resolve with its text.
 * @param {{ folder: string, date: string, includeSecondary: boolean }} params
 * @returns {Promise<string>}
 */
const fetchWorkSummary = ({ folder, date, includeSecondary }) =>
  new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).slice(2) + Date.now().toString(36);

    const handleMessage = (event) => {
      const message = event.data;
      if (!message || message.requestId !== requestId) return;
      if (message.type === 'workSummaryResult') {
        window.removeEventListener('message', handleMessage);
        resolve(message.summary);
      } else if (message.type === 'workSummaryError') {
        window.removeEventListener('message', handleMessage);
        reject(new Error(message.error));
      }
    };

    window.addEventListener('message', handleMessage);
    window.vscode.postMessage({
      command: 'getWorkSummary',
      folder,
      date,
      requestId,
      includeSecondary,
    });
  });

/** @param {{ folder: string, date: string, includeSecondary: boolean }} props */
const GetWorkSummaryButton = ({ folder, date, includeSecondary }) => (
  <CopyButton
    label="Summary"
    getText={() => fetchWorkSummary({ folder, date, includeSecondary })}
    className="summary-button"
  />
);

export default GetWorkSummaryButton;
