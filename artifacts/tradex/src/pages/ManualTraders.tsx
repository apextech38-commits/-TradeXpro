import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const DTRADER_URL = 'https://dtrader.tradexpro.co.ke';

// ── Keys must exactly match AuthContext.tsx constants ─────────────────────
const TOKEN_KEY    = 'tradex_access_token';   // localStorage, set after OAuth
const ACCOUNTS_KEY = 'tradex-deriv-accounts'; // localStorage, set after OAuth

export default function ManualTraders() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isLoggedIn, activeAccount, accounts, logout } = useAuth();

  const sendAuth = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return; // not logged in on main site — nothing to send

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
      DTRADER_URL, // never '*'
    );
  }, [activeAccount, accounts]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== DTRADER_URL) return;

      // dtrader iframe says it's ready → push current auth (silent SSO)
      if (event.data?.type === 'DTRADER_AUTH_READY') {
        if (isLoggedIn) sendAuth();
        return;
      }

      // user logged out *inside* the dtrader iframe → mirror it on the main site
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

  // main site logs out → tell the iframe to log out too (mirror in the other direction)
  useEffect(() => {
    if (isLoggedIn) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'AUTH_LOGOUT' }, DTRADER_URL);
  }, [isLoggedIn]);

  // Always mount the iframe — no lock screen. If the main site isn't logged in,
  // dtrader simply won't receive a TRADEXPRO_AUTH message and stays in its own
  // default state until the user logs in on the main site.
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        src={DTRADER_URL}
        title="Manual Traders"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow="clipboard-read; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}