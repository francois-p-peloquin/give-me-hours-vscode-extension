import React, { useState } from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import Accordion from './Accordion';

const post = (command) => () => window.vscode.postMessage({ command });

/**
 * The Harvest accordion (its title shows the connection status): change account/token,
 * change the fallback project, or disconnect (with an inline confirm, since the
 * webview can't show confirm()).
 *
 * @param {{
 *   harvest: import('../utils/harvestMapping').HarvestState,
 *   defaultLabel: string | null,
 * }} props
 */
const HarvestSettings = ({ harvest, defaultLabel }) => {
  const [confirming, setConfirming] = useState(false);

  if (harvest.pending) return null;

  if (!harvest.connected) {
    return (
      <Accordion title="Harvest · Not connected">
        <div className="harvest-settings">
          <p>
            Optional. Send your hours to Harvest, one entry per repo per day, with the work log as
            notes.
          </p>
          <div className="harvest-settings__buttons">
            <VSCodeButton onClick={post('harvestConnect')}>Configure Harvest</VSCodeButton>
          </div>
        </div>
      </Accordion>
    );
  }

  const status = harvest.unavailable ? 'Unreachable' : 'Connected';
  return (
    <Accordion
      title={`Harvest · ${status}${harvest.accountName ? ` to ${harvest.accountName}` : ''}`}
    >
      <div className="harvest-settings">
        <p>Account: {harvest.accountName || 'unknown'}</p>
        <p>Default project: {defaultLabel || 'none set'}</p>

        {confirming ? (
          <div className="notice notice--warning notice--actions">
            <span>
              Disconnect Harvest? Your token is removed from this machine. Repo project picks and
              the fallback stay in settings, so reconnecting picks up where you left off.
            </span>
            <span className="notice__buttons">
              <VSCodeButton
                onClick={() => {
                  setConfirming(false);
                  window.vscode.postMessage({ command: 'harvestDisconnect' });
                }}
              >
                Disconnect
              </VSCodeButton>
              <VSCodeButton appearance="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </VSCodeButton>
            </span>
          </div>
        ) : (
          <div className="harvest-settings__buttons">
            <VSCodeButton
              onClick={post('harvestConnect')}
              title="Paste a new token, or switch to another Harvest account"
            >
              Change account or token
            </VSCodeButton>
            <VSCodeButton onClick={post('harvestSetFallback')} disabled={harvest.unavailable}>
              Change fallback
            </VSCodeButton>
            <VSCodeButton onClick={() => setConfirming(true)}>Disconnect</VSCodeButton>
          </div>
        )}
      </div>
    </Accordion>
  );
};

export default HarvestSettings;
