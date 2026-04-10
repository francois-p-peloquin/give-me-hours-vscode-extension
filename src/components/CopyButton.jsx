import React, { useState } from 'react';
import ClipboardIcon from './ClipboardIcon';

/**
 * @param {{
 *   textToCopy?: string,
 *   label?: string,
 *   onCopy?: () => void,
 *   loading?: boolean,
 *   copied?: boolean,
 *   className?: string,
 * }} props
 *
 * Uncontrolled (hours): pass `textToCopy` only — manages its own copied state.
 * Controlled (Summary): pass `label` + `onCopy` + `loading` + `copied` — state lives in parent.
 */
const CopyButton = ({ textToCopy, label, onCopy, loading = false, copied: controlledCopied, className }) => {
  const [ownCopied, setOwnCopied] = useState(false);
  const copied = controlledCopied !== undefined ? controlledCopied : ownCopied;
  const isLabeled = label !== undefined;

  const handleClick = () => {
    if (loading) return;
    if (onCopy) {
      onCopy();
    } else if (textToCopy) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          setOwnCopied(true);
          setTimeout(() => setOwnCopied(false), 1500);
        })
        .catch((err) => console.error('Failed to copy text: ', err));
    }
  };

  const displayText = loading ? 'Loading' : (label ?? textToCopy);
  const buttonClass = ['copy-button', className].filter(Boolean).join(' ');

  return (
    <button
      onClick={handleClick}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      className={buttonClass}
    >
      {isLabeled ? <span>{displayText}</span> : displayText}
      <ClipboardIcon copied={copied} loading={loading} />
    </button>
  );
};

export default CopyButton;
