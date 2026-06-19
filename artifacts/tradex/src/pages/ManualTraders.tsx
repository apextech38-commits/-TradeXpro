import React, { useEffect, useRef } from 'react';

const ManualTraders: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Security: Only accept messages from your dtrader domain
      if (event.origin !== 'https://dtrader.tradexpro.co.ke') return;

      // 2. Respond to the 'TRADEX_READY' signal from the iframe
      if (event.data.type === 'TRADEX_READY') {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'TRADEX_AUTH',
          payload: {
            // Replace these with your actual Auth hook/method
            token1: localStorage.getItem('your_main_app_token1'),
            token2: localStorage.getItem('your_main_app_token2'),
          }
        }, 'https://dtrader.tradexpro.co.ke');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src="https://dtrader.tradexpro.co.ke"
      style={{ width: '100%', height: '85vh', border: 'none' }}
      title="Manual Traders"
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
    />
  );
};

export default ManualTraders;
