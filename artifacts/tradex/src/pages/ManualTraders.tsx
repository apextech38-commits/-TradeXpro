'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const TOKEN_KEY = "tradex_access_token";
const ACCOUNTS_KEY = "tradex-deriv-accounts";

export default function ManualTraders() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { activeAccount, accounts } = useAuth();

  useEffect(() => {
    const sendAuth = () => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const token = localStorage.getItem(TOKEN_KEY);
      const storedAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      if (!token || storedAccounts.length === 0) return;

      iframe.contentWindow.postMessage({
        type: 'TRADEX_AUTH',
        token,
        accounts: storedAccounts,
        activeAccountId: activeAccount?.account || storedAccounts[0]?.account,
      }, '*');
    };

    // Listen for iframe signaling it's ready
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TRADEX_READY') {
        sendAuth();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeAccount, accounts]);

  return (
    <iframe
      ref={iframeRef}
      src="/manualtraders/"
      title="Manual Traders"
      style={{ width: "100%", height: "calc(100vh - 56px)", border: "none" }}
    />
  );
}
