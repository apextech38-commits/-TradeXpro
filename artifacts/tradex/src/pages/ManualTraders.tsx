import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const TOKEN_KEY = "tradex_access_token";
const ACCOUNTS_KEY = "tradex-deriv-accounts";

export default function ManualTraders() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isLoggedIn, activeAccount } = useAuth();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendToken = () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      if (!token || !accounts.length) return;

      iframe.contentWindow?.postMessage({
        type: 'DERIV_TOKEN',
        access_token: token,
        account_id: activeAccount?.account || accounts[0]?.account,
        account_type: activeAccount?.account_type || accounts[0]?.account_type,
      }, 'https://tradexpro.co.ke');
    };

    iframe.addEventListener('load', sendToken);
    // Also send immediately if iframe already loaded
    if (iframe.contentDocument?.readyState === 'complete') sendToken();

    return () => iframe.removeEventListener('load', sendToken);
  }, [isLoggedIn, activeAccount]);

  return (
    <iframe
      ref={iframeRef}
      src="/manualtraders/"
      title="Manual Traders"
      style={{ width: "100%", height: "calc(100vh - 56px)", border: "none" }}
    />
  );
}
