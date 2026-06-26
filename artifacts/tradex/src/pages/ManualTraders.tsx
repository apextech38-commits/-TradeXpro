import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const DTRADER_URL   = 'https://dtrader.tradexpro.co.ke';

// ── Token keys: must match exactly what token-exchange.js writes ──────────
// token-exchange.js  →  sessionStorage.setItem('access_token', ...)
const TOKEN_KEY     = 'access_token';
const EXPIRES_KEY   = 'token_expires_at';

export default function ManualTraders() {
  const iframeRef                            = useRef<HTMLIFrameElement>(null);
  const { isLoggedIn, activeAccount, accounts } = useAuth();

  // ── Build and send the auth payload to the iframe ────────────────────
  const sendAuth = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const token      = sessionStorage.getItem(TOKEN_KEY);
    const expiresAt  = sessionStorage.getItem(EXPIRES_KEY);

    // Nothing to send — user is not authenticated
    if (!token) return;

    // Derive loginid from AuthContext (already resolved by main site auth)
    const loginid = activeAccount?.account ?? accounts?.[0]?.account ?? '';

    iframe.contentWindow.postMessage(
      {
        type:      'TRADEXPRO_AUTH',   // must match dtrader receiver
        token,
        expiresAt,
        loginid,
        accounts:  accounts ?? [],
      },
      DTRADER_URL,                     // never '*'
    );
  }, [activeAccount, accounts]);

  // ── Wire up message listener + load fallback ─────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleMessage = (event: MessageEvent) => {
      // Reject anything not from dtrader
      if (event.origin !== DTRADER_URL) return;

      if (event.data?.type === 'DTRADER_AUTH_READY') {
        sendAuth();
      }
    };

    // Fallback: send on iframe load in case READY signal was missed
    const handleLoad = () => sendAuth();

    window.addEventListener('message', handleMessage);
    iframe.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('message', handleMessage);
      iframe.removeEventListener('load', handleLoad);
    };
  }, [isLoggedIn, sendAuth]);

  // ── Not logged in — gate UI ───────────────────────────────────────────
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

  // ── Authenticated — render iframe ─────────────────────────────────────
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
