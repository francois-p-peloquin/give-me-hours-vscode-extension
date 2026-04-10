import React, { useState } from 'react';
import ClipboardIcon from './ClipboardIcon';

/** @param {{ textToCopy: string }} props */
const CopyButton = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch((err) => console.error('Failed to copy text: ', err));
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      className="copy-button"
    >
      {textToCopy}
      <ClipboardIcon copied={copied} />
    </button>
  );
};

export default CopyButton;
