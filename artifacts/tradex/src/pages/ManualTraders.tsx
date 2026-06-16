import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const TOKEN_KEY = "tradex_access_token";

export default function ManualTraders() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isLoggedIn, activeAccount } = useAuth();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendToken = () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      iframe.contentWindow?.postMessage(
        { type: 'DERIV_TOKEN', access_token: token },
        'https://tradexpro.co.ke'
      );
    };

    iframe.addEventListener('load', sendToken);
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
