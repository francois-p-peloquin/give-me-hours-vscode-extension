import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Acquire VS Code API once and make it globally accessible
if (typeof acquireVsCodeApi !== 'undefined') {
  window.vscode = acquireVsCodeApi();
} else {
  window.vscode = {
    postMessage: (message) => {
      console.log('Mock vscode.postMessage:', message);
    },
    getState: () => ({}),
    setState: (state) => {
      console.log('Mock vscode.setState:', state);
    },
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
