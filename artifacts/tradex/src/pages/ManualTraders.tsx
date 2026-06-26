import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const DTRADER_URL = 'https://dtrader.tradexpro.co.ke';

// ── Keys must exactly match AuthContext.tsx constants ─────────────────────
const TOKEN_KEY    = 'tradex_access_token';   // localStorage, set after OAuth
const ACCOUNTS_KEY = 'tradex-deriv-accounts'; // localStorage, set after OAuth

export default function ManualTraders() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isLoggedIn, activeAccount, accounts } = useAuth();

  const sendAuth = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    // Read from localStorage — that is where AuthContext writes after OAuth
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return; // not logged in, nothing to send

    let parsedAccounts = accounts;
    if (!parsedAccounts?.length) {
      try {
        parsedAccounts = JSON.parse(
          localStorage.getItem(ACCOUNTS_KEY) || '[]'
        );
      } catch {
        parsedAccounts = [];
      }
    }

    const loginid =
      activeAccount?.account ??
      parsedAccounts?.[0]?.account ??
      '';

    iframe.contentWindow.postMessage(
      {
        type:     'TRADEXPRO_AUTH',
        token,
        loginid,
        accounts: parsedAccounts,
      },
      DTRADER_URL, // never '*'
    );
  }, [activeAccount, accounts]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== DTRADER_URL) return;
      if (event.data?.type === 'DTRADER_AUTH_READY') {
        sendAuth();
      }
    };

    const handleLoad = () => sendAuth();

    window.addEventListener('message', handleMessage);
    iframe.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('message', handleMessage);
      iframe.removeEventListener('load', handleLoad);
    };
  }, [isLoggedIn, sendAuth]);

  if (!isLoggedIn) {
    return (
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        height:         'calc(100vh - 80px)',
        flexDirection:  'column',
        gap:            '12px',
        color:          '#94a3b8',
        background:     '#0B0F14',
      }}>
        <span style={{ fontSize: '2rem' }}>🔒</span>
        <p style={{ margin: 0, fontSize: '1rem' }}>
          Please log in to access Manual Traders
        </p>
      </div>
    );
  }

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
