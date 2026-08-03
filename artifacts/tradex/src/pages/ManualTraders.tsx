import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const DTRADER_URL = 'https://dtrader.tradexpro.co.ke';

// ── Keys must exactly match AuthContext.tsx constants ─────────────────────
const TOKEN_KEY    = 'tradex_access_token';   // localStorage, set after OAuth
const ACCOUNTS_KEY = 'tradex-deriv-accounts'; // localStorage, set after OAuth

export default function ManualTraders() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // True only after the iframe's native 'load' event fires, i.e. it has
  // actually navigated to DTRADER_URL. Before that it's still same-origin
  // about:blank, and postMessage(data, DTRADER_URL) on that window throws
  // every time (mismatched target vs actual recipient origin) — confirmed
  // in the live console: "target origin provided (dtrader.tradexpro.co.ke)
  // does not match the recipient window's origin (tradexpro.co.ke)".
  const iframeLoadedRef = useRef(false);
  // Mirrors iframeLoadedRef but as state, purely to drive the loading overlay.
  const [isReady, setIsReady] = useState(false);
  // Tracks the last loginid we actually sent, so we can tell when a NEW send
  // is about to trigger auth-bridge.ts's own reload -- that's the moment to
  // show the overlay again, rather than leaving a stale/wrong-account view
  // on screen with no indication anything is happening.
  const lastSentLoginidRef = useRef<string | null>(null);
  const { isLoggedIn, activeAccount, accounts, logout } = useAuth();

  const sendAuth = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !iframeLoadedRef.current) {
      console.log('[ManualTraders] sendAuth skipped -- iframe not loaded yet', {
        has_content_window: !!iframe?.contentWindow,
        iframe_loaded: iframeLoadedRef.current,
      });
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      console.log('[ManualTraders] sendAuth skipped -- no token in localStorage, not logged in on main site');
      return;
    }

    let parsedAccounts = accounts;
    if (!parsedAccounts?.length) {
      try {
        parsedAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      } catch {
        parsedAccounts = [];
      }
    }

    const loginid = activeAccount?.account ?? parsedAccounts?.[0]?.account ?? '';

    // This mirrors auth-bridge.ts's own "reload if the account actually
    // changed" check. If it's about to reload, show the overlay now instead
    // of leaving the previous (soon to be stale) account's screen visible
    // for however long the reload takes. The very first send (nothing sent
    // yet this mount) is a normal boot, not a switch -- no overlay needed
    // beyond the one already showing before the iframe's first load.
    const isAccountChange = loginid && lastSentLoginidRef.current !== null && loginid !== lastSentLoginidRef.current;
    if (loginid) lastSentLoginidRef.current = loginid;
    if (isAccountChange) {
      iframeLoadedRef.current = false;
      setIsReady(false);
    }

    console.log('[ManualTraders] sending TRADEXPRO_AUTH', {
      loginid,
      accounts_count: parsedAccounts?.length ?? 0,
      target_origin: DTRADER_URL,
    });

    iframe.contentWindow.postMessage(
      { type: 'TRADEXPRO_AUTH', token, loginid, accounts: parsedAccounts },
      DTRADER_URL, // never '*'
    );
  }, [activeAccount, accounts]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== DTRADER_URL) {
        console.log('[ManualTraders] ignoring message from unexpected origin', event.origin, event.data);
        return;
      }

      console.log('[ManualTraders] received message from iframe', event.data?.type);

      // dtrader iframe says it's ready → push current auth (silent SSO)
      if (event.data?.type === 'DTRADER_AUTH_READY') {
        if (isLoggedIn) sendAuth();
        else console.log('[ManualTraders] got DTRADER_AUTH_READY but isLoggedIn is false -- not sending');
        return;
      }

      // user logged out *inside* the dtrader iframe → mirror it on the main site
      if (event.data?.type === 'DTRADER_LOGOUT') {
        logout();
        return;
      }
    };

    const handleLoad = () => {
      console.log('[ManualTraders] iframe load event fired, isLoggedIn:', isLoggedIn);
      iframeLoadedRef.current = true;
      setIsReady(true);
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
    if (!iframeLoadedRef.current) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'AUTH_LOGOUT' }, DTRADER_URL);
  }, [isLoggedIn]);

  // DTRADER_AUTH_READY is a one-time ping the iframe sends right after its own
  // bootstrap finishes. If isLoggedIn was still false at that exact moment
  // (AuthContext hadn't finished restoring the session from localStorage yet),
  // sendAuth() was skipped above and never retried — the iframe stays in its
  // logged-out/default state for the rest of that mount. Proactively resend
  // once isLoggedIn actually settles to true, so a late-resolving session
  // doesn't get missed.
  useEffect(() => {
    if (isLoggedIn) sendAuth();
  }, [isLoggedIn, sendAuth]);

  // Always mount the iframe — no lock screen. If the main site isn't logged in,
  // dtrader simply won't receive a TRADEXPRO_AUTH message and stays in its own
  // default state until the user logs in on the main site.
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {!isReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'var(--background, #fff)',
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid rgba(120,120,120,0.25)',
              borderTopColor: 'currentColor',
              borderRadius: '50%',
              animation: 'tradexpro-spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)' }}>Loading Manual Traders&hellip;</span>
          <style>{'@keyframes tradexpro-spin { to { transform: rotate(360deg); } }'}</style>
        </div>
      )}
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