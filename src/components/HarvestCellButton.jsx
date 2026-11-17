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
 * "Add to Harvest" for one or more repo/day entries: a single cell, a day column's
 * total, or a repo's week total. Shows "✓ In Harvest" once every entry has been sent
 * (from any button), or "✓ 2/3 in Harvest" when only some have. Clicking always opens
 * the confirm dialog, which warns before adding more.
 *
 * @param {{
 *   harvest: import('../utils/harvestMapping').HarvestState,
 *   rows: Array<{ folder: string, date: string, hoursDecimal: number }>,
 *   onClick: () => void,
 * }} props
 */
const HarvestCellButton = ({ harvest, rows, onClick }) => {
  const sends = rows
    .map((r) => harvest.previousSends?.[cellSendKey(r.folder, r.date)])
    .filter(Boolean);
  const hours = rows.reduce((sum, r) => sum + r.hoursDecimal, 0).toFixed(2);
  const entries = rows.length === 1 ? '1 entry' : `${rows.length} entries`;

  let label = 'Add to Harvest';
  let title = `Add ${hours}h (${entries}) to Harvest`;
  if (sends.length > 0) {
    const last = Math.max(...sends.map((s) => s.at));
    const sentHours = sends.reduce((sum, s) => sum + s.totalHours, 0).toFixed(2);
    label = sends.length === rows.length ? '✓ In Harvest' : `✓ ${sends.length}/${rows.length} in Harvest`;
    title = `${sentHours}h already in Harvest (last sent ${formatWhen(last)}). Click to add more.`;
  }

  return (
    <button
      type="button"
      className={`copy-button harvest-cell-button${sends.length ? ' harvest-cell-button--sent' : ''}`}
      onClick={onClick}
      title={title}
    >
      <span>{label}</span>
    </button>
  );
};

export default HarvestCellButton;
