import { VSCodeButton, VSCodeLink } from '@vscode/webview-ui-toolkit/react';
import React, { useState, useRef, useEffect } from 'react';

const GetWorkSummaryButton = ({ folder, date }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const requestIdRef = useRef(null); // Use ref to store the requestId

    useEffect(() => {
        const handleMessage = event => {
            const message = event.data;
            // Only process messages that match our requestId
            if (message.requestId === requestIdRef.current) {
                switch (message.type) {
                    case 'workSummaryResult':
                        navigator.clipboard.writeText(message.summary).then(() => {
                            setIsCopied(true);
                            setIsLoading(false);
                            setTimeout(() => setIsCopied(false), 1500);
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
                requestIdRef.current = null; // Clear requestId after processing
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

    const handleClick = async () => {
        setIsLoading(true);
        setIsCopied(false); // Reset copied state

        try {
            const newRequestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            requestIdRef.current = newRequestId; // Store the new requestId

            window.vscode.postMessage({
                command: 'getWorkSummary',
                folder: folder,
                date: date,
                requestId: newRequestId, // Include requestId in the message
            });

        } catch (error) {
            console.error('Error getting work summary:', error);
            setIsLoading(false);
        }
    };

    return (
        <VSCodeLink onClick={handleClick} disabled={isLoading} className="summmary-button" title={isCopied ? 'Copied!' : 'Get work summary'}>
            {isLoading ? 'Loading...' : (isCopied ? 'Copied!' : 'Summary')}
            {isCopied ? ' ✅' : ' 📋'}
        </VSCodeLink>
    );
};

export default GetWorkSummaryButton;
