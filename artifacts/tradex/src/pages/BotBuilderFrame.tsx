import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const BOTBUILDER_URL = 'https://botbuilder.tradexpro.co.ke';

const TOKEN_KEY    = 'tradex_access_token';
const ACCOUNTS_KEY = 'tradex-deriv-accounts';

export default function BotBuilderFrame() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isLoggedIn, activeAccount, accounts, logout } = useAuth();

  const sendAuth = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    let parsedAccounts = accounts;
    if (!parsedAccounts?.length) {
      try {
        parsedAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      } catch {
        parsedAccounts = [];
      }
    }

    const loginid = activeAccount?.account ?? parsedAccounts?.[0]?.account ?? '';

    iframe.contentWindow.postMessage(
      { type: 'TRADEXPRO_AUTH', token, loginid, accounts: parsedAccounts },
      BOTBUILDER_URL,
    );
  }, [activeAccount, accounts]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== BOTBUILDER_URL) return;

      if (event.data?.type === 'DTRADER_AUTH_READY') {
        if (isLoggedIn) sendAuth();
        return;
      }

      if (event.data?.type === 'DTRADER_LOGOUT') {
        logout();
        return;
      }
    };

    const handleLoad = () => {
      if (isLoggedIn) sendAuth();
    };

    window.addEventListener('message', handleMessage);
    iframe.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('message', handleMessage);
      iframe.removeEventListener('load', handleLoad);
    };
  }, [isLoggedIn, sendAuth, logout]);

  useEffect(() => {
    if (isLoggedIn) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'AUTH_LOGOUT' }, BOTBUILDER_URL);
  }, [isLoggedIn]);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        src={BOTBUILDER_URL}
        title="Bot Builder"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow="clipboard-read; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
