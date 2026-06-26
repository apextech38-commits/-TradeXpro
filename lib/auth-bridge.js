/**
 * auth-bridge.js — TradeXpro main site
 * Keys verified against AuthContext.tsx:
 *   TOKEN_KEY    = 'tradex_access_token'  (localStorage)
 *   ACCOUNTS_KEY = 'tradex-deriv-accounts' (localStorage)
 */

const DTRADER_ORIGIN = 'https://dtrader.tradexpro.co.ke';

// Exact keys from AuthContext.tsx — do not change these
const TOKEN_KEY    = 'tradex_access_token';
const ACCOUNTS_KEY = 'tradex-deriv-accounts';

function readTokens() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  let accounts = [];
  try { accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); }
  catch { /* ignore */ }

  return { token, accounts };
}

function sendTokens(iframe, payload) {
  iframe?.contentWindow?.postMessage(
    { type: 'TRADEXPRO_AUTH', ...payload },
    DTRADER_ORIGIN,
  );
}

export function bridgeLogout(iframe) {
  iframe?.contentWindow?.postMessage({ type: 'AUTH_LOGOUT' }, DTRADER_ORIGIN);
}

export function bridgeAuthToIframe(iframe) {
  let sent = false;

  const onMessage = (event) => {
    if (event.origin !== DTRADER_ORIGIN) return;
    if (event.data?.type !== 'DTRADER_AUTH_READY') return;
    const tokens = readTokens();
    if (tokens) { sendTokens(iframe, tokens); sent = true; }
  };

  const onFreshLogin = (event) => {
    sendTokens(iframe, event.detail);
    sent = true;
  };

  window.addEventListener('message', onMessage);
  window.addEventListener('tradexpro:auth:tokens', onFreshLogin);

  const fallback = setTimeout(() => {
    if (sent) return;
    const tokens = readTokens();
    if (tokens) { sendTokens(iframe, tokens); sent = true; }
  }, 3000);

  return () => {
    window.removeEventListener('message', onMessage);
    window.removeEventListener('tradexpro:auth:tokens', onFreshLogin);
    clearTimeout(fallback);
  };
}
