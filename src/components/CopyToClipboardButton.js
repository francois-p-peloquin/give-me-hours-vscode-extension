import React, { useState } from 'react';

const CopyToClipboardButton = ({ textToCopy, children = '📋' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 1500); // Reset after 1.5 seconds
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  return (
    <button onClick={handleCopy} title="Copy to clipboard" className="copy-button">
      {copied ? 'Copied!' : children}
    </button>
  );
};

export default CopyToClipboardButton;
