
const CONFIG = {

  CLIENT_ID:      '33ughhvgtxloGWBQQZEeD',

  REDIRECT_URI:   'https://tradexpro.co.ke/callback',

  SCOPE:          'trade account_manage',

  AUTH_ENDPOINT:  'https://auth.deriv.com/oauth2/auth',

  LEGACY_APP_ID:  null,

  PARTNER: {

    tracking_token: null,

    tracking_param: 't',

    utm_campaign:   null,

    utm_medium:     'affiliate',

    utm_source:     null,

  },

};

function generateCodeVerifier() {

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

  const array = crypto.getRandomValues(new Uint8Array(64));

  return Array.from(array).map(v => chars[v % chars.length]).join('');

}

async function generateCodeChallenge(verifier) {

  const encoded = new TextEncoder().encode(verifier);

  const hash = await crypto.subtle.digest('SHA-256', encoded);

  return btoa(String.fromCharCode(...new Uint8Array(hash)))

    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

}

function generateState() {

  return crypto.getRandomValues(new Uint8Array(16))

    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

}

async function buildAuthURL(mode = 'login') {

  const codeVerifier  = generateCodeVerifier();

  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const state         = generateState();

  sessionStorage.setItem('pkce_code_verifier', codeVerifier);

  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({

    response_type: 'code', client_id: CONFIG.CLIENT_ID,

    redirect_uri: CONFIG.REDIRECT_URI, scope: CONFIG.SCOPE,

    state, code_challenge: codeChallenge, code_challenge_method: 'S256',

  });

  if (mode === 'signup') {

    params.set('prompt', 'registration');

    const p = CONFIG.PARTNER;

    if (p.tracking_token) params.set(p.tracking_param, p.tracking_token);

    if (p.utm_campaign)   params.set('utm_campaign', p.utm_campaign);

    if (p.utm_medium)     params.set('utm_medium',   p.utm_medium);

    if (p.utm_source)     params.set('utm_source',   p.utm_source);

  }

  if (CONFIG.LEGACY_APP_ID) params.set('app_id', CONFIG.LEGACY_APP_ID);

  return `${CONFIG.AUTH_ENDPOINT}?${params.toString()}`;

}

export async function loginWithDeriv()  { window.location.href = await buildAuthURL('login');  }

export async function signUpWithDeriv() { window.location.href = await buildAuthURL('signup'); }

export function handleCallback() {

  const params = new URLSearchParams(window.location.search);

  const error  = params.get('error');

  if (error) {

    sessionStorage.removeItem('pkce_code_verifier');

    sessionStorage.removeItem('oauth_state');

    throw new Error(`OAuth error: ${error} — ${params.get('error_description') ?? ''}`);

  }

  const returnedState = params.get('state');

  const code          = params.get('code');

  const codeVerifier  = sessionStorage.getItem('pkce_code_verifier');

  const storedState   = sessionStorage.getItem('oauth_state');

  sessionStorage.removeItem('pkce_code_verifier');

  sessionStorage.removeItem('oauth_state');

  if (returnedState !== storedState) throw new Error('State mismatch — CSRF check failed.');

  if (!code)         throw new Error('No authorization code in callback.');

  if (!codeVerifier) throw new Error('code_verifier missing — tab may have been closed mid-flow.');

  window.history.replaceState({}, document.title, window.location.pathname);

  return { code, codeVerifier };

}

