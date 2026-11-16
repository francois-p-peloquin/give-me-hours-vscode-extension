import { requestFromHost } from './request';

/**
 * Copy text via the extension host (vscode.env.clipboard).
 * The webview's navigator.clipboard is unreliable: it rejects whenever the
 * webview document doesn't have focus at the moment of the write.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export const copyToClipboard = async (text) => {
  await requestFromHost(
    'copyToClipboard',
    { text },
    { resultType: 'copyResult', errorType: 'copyError', timeout: 5000 }
  );
};
