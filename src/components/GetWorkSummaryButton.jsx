import React, { useState, useRef, useEffect } from 'react';
import CopyButton from './CopyButton';

/** @param {{ folder: string, date: string, useAISummary: boolean }} props */
const GetWorkSummaryButton = ({ folder, date, useAISummary }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const requestIdRef = useRef(/** @type {string | null} */ (null));

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      if (message.requestId === requestIdRef.current) {
        switch (message.type) {
          case 'workSummaryResult':
            navigator.clipboard
              .writeText(message.summary)
              .then(() => {
                setIsCopied(true);
                setIsLoading(false);
                setTimeout(() => setIsCopied(false), 1500);
              })
              .catch((err) => {
                console.error('Failed to copy summary:', err);
                setIsLoading(false);
              });
            break;
          case 'workSummaryError':
            console.error('Error from extension:', message.error);
            setIsLoading(false);
            break;
        }
        requestIdRef.current = null;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleClick = () => {
    if (isLoading) return;
    setIsLoading(true);
    setIsCopied(false);

    const newRequestId =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    requestIdRef.current = newRequestId;

    window.vscode.postMessage({
      command: 'getWorkSummary',
      folder,
      date,
      requestId: newRequestId,
      useAISummary,
    });
  };

  return (
    <CopyButton
      label="Summary"
      onCopy={handleClick}
      loading={isLoading}
      copied={isCopied}
      className="summary-button"
    />
  );
};

export default GetWorkSummaryButton;
