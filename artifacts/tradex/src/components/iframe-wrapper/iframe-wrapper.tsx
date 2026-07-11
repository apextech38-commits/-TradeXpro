import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getToken, getLoginId } from '@/external/bot-skeleton/services/api/appId';
import './iframe-wrapper.scss';

interface IframeWrapperProps {
    src: string;
    title: string;
    className?: string;
}

const IframeWrapper: React.FC<IframeWrapperProps> = observer(({ src, title, className = '' }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const sendAuthData = useCallback(() => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;

        const { token, account_id } = getToken();
        const loginid = getLoginId();
        const payload = {
            type: 'DERIV_APP_AUTH',
            token,
            loginid: loginid || account_id,
            timestamp: Date.now(),
        };

        try {
            iframe.contentWindow.postMessage(payload, '*');
        } catch (error) {
            console.warn('[IframeWrapper] Failed to send auth message:', error);
        }
    }, []);

    const handleMessage = useCallback(
        (event: MessageEvent) => {
            if (event.origin !== new URL(src).origin) return;
            const { data } = event;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'DERIV_APP_IFRAME_READY') {
                sendAuthData();
            }
        },
        [sendAuthData, src]
    );

    const handleLoad = useCallback(() => {
        setIsLoading(false);
        setHasError(false);
    }, []);

    const handleError = useCallback(() => {
        setIsLoading(false);
        setHasError(true);
    }, []);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        window.addEventListener('message', handleMessage);

        const authCheckInterval = setInterval(() => {
            const { token: currentToken } = getToken();
            const currentLoginId = getLoginId();
            sendAuthData();
            if (currentToken && currentLoginId) {
                sendAuthData();
            }
        }, 5000);

        const loadTimeout = setTimeout(() => {
            if (isLoading) {
                setIsLoading(false);
            }
        }, 10000);

        iframe.addEventListener('load', handleLoad);
        iframe.addEventListener('error', handleError);

        return () => {
            iframe.removeEventListener('load', handleLoad);
            iframe.removeEventListener('error', handleError);
            window.removeEventListener('message', handleMessage);
            clearInterval(authCheckInterval);
            clearTimeout(loadTimeout);
        };
    }, [handleError, handleLoad, handleMessage, isLoading, sendAuthData]);

    const content = useMemo(() => {
        if (hasError) {
            return (
                <div className='iframe-wrapper__error'>
                    <p>Failed to load {title}</p>
                    <a href={src} target='_blank' rel='noopener noreferrer'>
                        Open in new tab
                    </a>
                </div>
            );
        }
        return null;
    }, [hasError, src, title]);

    return (
        <div className={`iframe-wrapper ${className}`}>
            {isLoading && !hasError && <div className='iframe-wrapper__loading'>Loading {title}...</div>}
            {content}
            <iframe
                ref={iframeRef}
                src={src}
                title={title}
                className='iframe-wrapper__frame'
                frameBorder='0'
                allowFullScreen
                loading='eager'
                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; display-capture'
                referrerPolicy='no-referrer-when-downgrade'
            />
        </div>
    );
});

export default IframeWrapper;
