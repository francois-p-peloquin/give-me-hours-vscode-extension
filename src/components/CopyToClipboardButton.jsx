import React, { useState } from 'react';
import ClipboardIcon from './ClipboardIcon';

const CopyToClipboardButton = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 1500); // Reset after 1.5 seconds
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      });
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      className="copy-button"
    >
      <ClipboardIcon copied={copied} />
    </button>
  );
};

export default CopyToClipboardButton;
