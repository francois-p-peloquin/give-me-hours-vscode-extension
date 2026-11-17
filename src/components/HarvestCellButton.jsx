import React from 'react';
import { cellSendKey } from '../utils/harvestMapping';

const formatWhen = (ms) =>
  new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * "Add to Harvest" for one repo on one day. Shows "✓ In Harvest" once that cell has
 * been sent (from here or from the header's day/week send); clicking again still
 * opens the confirm dialog, which warns before adding more.
 *
 * @param {{
 *   harvest: import('../utils/harvestMapping').HarvestState,
 *   cell: { folder: string, date: string, hoursDecimal: number },
 *   onClick: () => void,
 * }} props
 */
const HarvestCellButton = ({ harvest, cell, onClick }) => {
  const sent = harvest.previousSends?.[cellSendKey(cell.folder, cell.date)];
  const hours = cell.hoursDecimal.toFixed(2);

  return (
    <button
      type="button"
      className={`copy-button harvest-cell-button${sent ? ' harvest-cell-button--sent' : ''}`}
      onClick={onClick}
      title={
        sent
          ? `Sent ${sent.totalHours.toFixed(2)}h to Harvest on ${formatWhen(sent.at)}. Click to add more.`
          : `Add ${hours}h for ${cell.folder} to Harvest`
      }
    >
      <span>{sent ? '✓ In Harvest' : 'Add to Harvest'}</span>
    </button>
  );
};

export default HarvestCellButton;
