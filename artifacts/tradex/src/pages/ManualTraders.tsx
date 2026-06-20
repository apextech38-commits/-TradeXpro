import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const DTRADER_URL = 'https://dtrader.tradexpro.co.ke';
const LOGINID_KEY = 'active_loginid';

export default function ManualTraders() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isLoggedIn, activeAccount } = useAuth();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendAuth = () => {
      // Send the OAuth Bearer token — what dtrader needs to call fetchAccounts()
      const authInfo = JSON.parse(sessionStorage.getItem('auth_info') || 'null');
      const token = authInfo?.access_token;
      const loginid = localStorage.getItem(LOGINID_KEY);
      if (!token) return;
      iframe.contentWindow?.postMessage({
        type: 'TRADEXPRO_AUTH',
        token,
        loginid,
      }, DTRADER_URL);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== DTRADER_URL) return;
      if (event.data?.type === 'DTRADER_AUTH_READY') sendAuth();
    };

    window.addEventListener('message', handleMessage);
    iframe.addEventListener('load', sendAuth);

    return () => {
      window.removeEventListener('message', handleMessage);
      iframe.removeEventListener('load', sendAuth);
    };
  }, [isLoggedIn, activeAccount]);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        src={DTRADER_URL}
        title="Manual Traders"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
