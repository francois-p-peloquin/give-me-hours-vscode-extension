import React, { useState } from 'react';
import ClipboardIcon from './ClipboardIcon';
import { copyToClipboard } from '../utils/clipboard';

/**
 * @param {{
 *   textToCopy?: string,
 *   getText?: () => Promise<string>,
 *   label?: string,
 *   className?: string,
 * }} props
 *
 * Every copy in the app goes through this component.
 * - Static text (hours): pass `textToCopy`; it's also the button label.
 * - Fetched text (Summary): pass `label` + `getText`; the button shows "Loading" until it resolves.
 */
const CopyButton = ({ textToCopy, getText, label, className }) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const isLabeled = label !== undefined;

  const handleClick = async () => {
    if (loading) return;
    setCopied(false);
    try {
      let text = textToCopy;
      if (getText) {
        setLoading(true);
        text = await getText();
      }
      if (!text) return;
      await copyToClipboard(String(text));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    } finally {
      setLoading(false);
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
