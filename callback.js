import { handleCallback } from './pkce-auth.js';

async function processCallback() {
  let code, codeVerifier;
  try {
    ({ code, codeVerifier } = handleCallback());
  } catch (err) {
    console.error('[callback] Auth error:', err.message);
    document.body.innerHTML = `<p style="color:red;font-family:monospace">Auth failed: ${err.message}</p>`;
    return;
  }

  try {
    const res = await fetch('/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, codeVerifier }),
    });
    const tokenData = await res.json();
    if (!res.ok) throw new Error(tokenData.error_description ?? tokenData.error);

    sessionStorage.setItem('access_token', tokenData.access_token);
    sessionStorage.setItem('token_expires_at', Date.now() + tokenData.expires_in * 1000);

    window.location.href = '/dashboard';
  } catch (err) {
    console.error('[callback] Token exchange error:', err.message);
    document.body.innerHTML = `<p style="color:red;font-family:monospace">Token exchange failed: ${err.message}</p>`;
  }
}

processCallback();
