/**
 * token-exchange.js
 * Keys verified against AuthContext.tsx
 */
const AUTH_CONFIG = {
  TOKEN_ENDPOINT: 'https://auth.deriv.com/oauth2/token',
  CLIENT_ID:      '33ughhvgtxloGWBQQZEeD',
};

export async function exchangeToken(code, codeVerifier) {
  const params = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id:     AUTH_CONFIG.CLIENT_ID,
    redirect_uri:  `${window.location.origin}/callback`,
  });

  const res = await fetch(AUTH_CONFIG.TOKEN_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  const tokenData = await res.json();
  if (!res.ok) throw new Error(tokenData.error_description ?? tokenData.error);

  // AuthContext uses localStorage + key 'tradex_access_token'
  localStorage.setItem('tradex_access_token', tokenData.access_token);

  // Fire event for auth bridge relay to iframe
  window.dispatchEvent(
    new CustomEvent('tradexpro:auth:tokens', {
      detail: { token: tokenData.access_token },
    })
  );

  return tokenData;
}
