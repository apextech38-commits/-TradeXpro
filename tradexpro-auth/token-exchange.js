
import express  from 'express';

import fetch    from 'node-fetch';
// Add near top with other imports
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Add before app.listen(...)
app.use(express.static(path.join(__dirname, '..')));
app.get('/callback', (req, res) =>
  res.sendFile(path.join(__dirname, '../callback.html'))
);
const app = express();

app.use(express.json());

const CONFIG = {

  CLIENT_ID:      process.env.DERIV_CLIENT_ID    ?? '33ughhvgtxloGWBQQZEeD',

  REDIRECT_URI:   process.env.DERIV_REDIRECT_URI ?? 'https://tradexpro.co.ke/callback',

  TOKEN_ENDPOINT: 'https://auth.deriv.com/oauth2/token',

};

app.post('/auth/token', async (req, res) => {

  const { code, codeVerifier } = req.body;

  if (!code || !codeVerifier) {

    return res.status(400).json({ error: 'code and codeVerifier are required' });

  }

  const body = new URLSearchParams({

    grant_type:    'authorization_code',

    client_id:     CONFIG.CLIENT_ID,

    code,

    code_verifier: codeVerifier,

    redirect_uri:  CONFIG.REDIRECT_URI,

  });

  try {

    const derivRes = await fetch(CONFIG.TOKEN_ENDPOINT, {

      method:  'POST',

      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },

      body:    body.toString(),

    });

    const data = await derivRes.json();

    if (!derivRes.ok) {

      return res.status(derivRes.status).json({ error: data.error, error_description: data.error_description });

    }

    return res.json(data);

  } catch (err) {

    return res.status(502).json({ error: 'Failed to reach Deriv token endpoint' });

  }

});

app.listen(3001, () => console.log('Token exchange server running on :3001'));


// Static file serving
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '..')));
app.get('/callback', (req, res) => res.sendFile(path.join(__dirname, '../callback.html')));
