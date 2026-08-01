import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const CHARTS_URL = 'https://charts.tradexpro.co.ke';
const TOKEN_KEY    = 'tradex_access_token';
const ACCOUNTS_KEY = 'tradex-deriv-accounts';

export default function ChartsEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeLoadedRef = useRef(false);
  const { isLoggedIn, activeAccount, accounts } = useAuth();

  const sendAuth = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !iframeLoadedRef.current) return;

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
      CHARTS_URL,
    );
  }, [activeAccount, accounts]);

  // Send auth once the iframe finishes loading
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      iframeLoadedRef.current = true;
      if (isLoggedIn) sendAuth();
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [isLoggedIn, sendAuth]);

  // Resend whenever the active account changes (e.g. Demo ↔ Real switch)
  useEffect(() => {
    if (isLoggedIn && iframeLoadedRef.current) sendAuth();
  }, [activeAccount, isLoggedIn, sendAuth]);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 80px)', overflow: 'hidden', position: 'relative' }}>
      <iframe
        ref={iframeRef}
        src={CHARTS_URL}
        title="TradeX PRO Charts"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow="fullscreen"
      />
    </div>
  );
}
