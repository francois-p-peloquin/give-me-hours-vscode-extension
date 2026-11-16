/**
 * Send a command to the extension host and wait for its reply, matched by requestId.
 *
 * @param {string} command
 * @param {object} payload
 * @param {{
 *   resultType: string,
 *   errorType: string,
 *   timeout?: number,
 *   onMessage?: (message: any) => void,
 * }} options
 *   `onMessage` receives any other message carrying this request's id (e.g. progress).
 *   `timeout` in ms; omit to wait indefinitely.
 * @returns {Promise<any>} the result message
 */
export const requestFromHost = (command, payload, { resultType, errorType, timeout, onMessage }) =>
  new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      if (timer) clearTimeout(timer);
    };

    const handleMessage = (event) => {
      const message = event.data;
      if (!message || message.requestId !== requestId) return;
      if (message.type === resultType) {
        cleanup();
        resolve(message);
      } else if (message.type === errorType) {
        cleanup();
        reject(new Error(message.error));
      } else if (onMessage) {
        onMessage(message);
      }
    };

    if (timeout) {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for ${command}`));
      }, timeout);
    }

    window.addEventListener('message', handleMessage);
    window.vscode.postMessage({ command, ...payload, requestId });
  });
