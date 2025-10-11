import React, { useState } from 'react';

const GetWorkSummaryButton = ({ folder, date }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const handleClick = async () => {
        setIsLoading(true);
        setIsCopied(false); // Reset copied state

        try {
            // Send a message to the extension backend
            window.vscode.postMessage({
                command: 'getWorkSummary',
                folder: folder,
                date: date,
            });

            // Listen for messages from the extension
            window.addEventListener('message', event => {
                const message = event.data; // The JSON data our extension sent
                switch (message.type) {
                    case 'workSummaryResult':
                        navigator.clipboard.writeText(message.summary).then(() => {
                            setIsCopied(true);
                            setIsLoading(false);
                            setTimeout(() => setIsCopied(false), 1500); // Hide "Copied!" after 3 seconds
                        }).catch(err => {
                            console.error('Failed to copy summary:', err);
                            setIsLoading(false);
                        });
                        break;
                    case 'workSummaryError':
                        console.error('Error from extension:', message.error);
                        setIsLoading(false);
                        break;
                }
            });

        } catch (error) {
            console.error('Error getting work summary:', error);
            setIsLoading(false);
        }
    };

    return (
        <button
            className="copy-button summary-button" // Reusing copy-button style, adding summary-button for potential specific styles
            onClick={handleClick}
            disabled={isLoading}
        >
            {isLoading ? 'Loading...' : (isCopied ? 'Copied!' : 'Get Work Summary')}
        </button>
    );
};

export default GetWorkSummaryButton;
