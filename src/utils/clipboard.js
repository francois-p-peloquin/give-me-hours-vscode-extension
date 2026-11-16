/**
 * Copy text via the extension host (vscode.env.clipboard).
 * The webview's navigator.clipboard is unreliable: it rejects whenever the
 * webview document doesn't have focus at the moment of the write.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export const copyToClipboard = (text) =>
  new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).slice(2) + Date.now().toString(36);

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };

    const handleMessage = (event) => {
      const message = event.data;
      if (!message || message.requestId !== requestId) return;
      if (message.type === 'copyResult') {
        cleanup();
        resolve();
      } else if (message.type === 'copyError') {
        cleanup();
        reject(new Error(message.error));
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for clipboard copy'));
    }, 5000);

    window.addEventListener('message', handleMessage);
    window.vscode.postMessage({ command: 'copyToClipboard', text, requestId });
  });
