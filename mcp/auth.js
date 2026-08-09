/**
 * mcp/auth.js
 *
 * Minimal single-user OAuth 2.1 authorization server for the /mcp connector.
 *
 * There is exactly one trusted user (the app owner) and one pre-registered
 * OAuth client (claude.ai, configured with a static Client ID/Secret pasted
 * into its "Add custom connector" Advanced settings) — so this deliberately
 * skips Dynamic Client Registration (RFC 7591) and any real user database.
 * "Login" is a single shared password gate on /authorize.
 *
 * Codes/tokens are kept in memory: fine for one low-traffic user, and a
 * restart just forces re-authorization (claude.ai will prompt again).
 */

const crypto = require('crypto');
const express = require('express');
const { InvalidTokenError, InvalidGrantError } = require('@modelcontextprotocol/sdk/server/auth/errors.js');

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes to complete the redirect
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function loginPage({ action, hidden, error }) {
  const hiddenFields = Object.entries(hidden)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Workout Tracker — Sign in</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: system-ui, sans-serif; background: #111827; color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  form { background: #1f2937; padding: 32px; border-radius: 12px; width: 280px; box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
  h1 { font-size: 1.1rem; margin: 0 0 20px; }
  input[type=password] { width: 100%; box-sizing: border-box; padding: 10px; border-radius: 6px; border: 1px solid #374151; background: #111827; color: #f3f4f6; margin-bottom: 12px; }
  button { width: 100%; padding: 10px; border-radius: 6px; border: none; background: #3b82f6; color: white; font-weight: 600; cursor: pointer; }
  .error { color: #f87171; font-size: 0.85rem; margin-bottom: 12px; }
</style>
</head><body>
<form method="POST" action="${escapeHtml(action)}">
  <h1>Authorize Workout Tracker access</h1>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
  ${hiddenFields}
  <input type="password" name="password" placeholder="Password" autofocus required>
  <button type="submit">Authorize</button>
</form>
</body></html>`;
}

/**
 * @param {object} opts
 * @param {string} opts.clientId
 * @param {string} opts.clientSecret
 * @param {string[]} opts.redirectUris
 * @param {string} opts.loginPassword
 */
function createAuthProvider({ clientId, clientSecret, redirectUris, loginPassword }) {
  const client = {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
  };

  // authorizationCode -> { codeChallenge, clientId, redirectUri, scopes, resource, expiresAt }
  const codes = new Map();
  // accessToken -> { clientId, scopes, resource, expiresAt }
  const accessTokens = new Map();
  // refreshToken -> { clientId, scopes, resource, expiresAt }
  const refreshTokens = new Map();

  function prune(map) {
    const now = Date.now();
    for (const [key, val] of map) if (val.expiresAt < now) map.delete(key);
  }

  const clientsStore = {
    getClient(id) {
      return id === client.client_id ? client : undefined;
    },
    // registerClient intentionally unimplemented: disables Dynamic Client
    // Registration (mcpAuthRouter only mounts /register if this exists).
  };

  // Router mounted alongside mcpAuthRouter for the password-check POST that
  // actually issues the code + redirect. Kept separate from provider.authorize()
  // because the SDK's authorize handler only passes (client, params, res) to
  // that method — no access to the submitted password field.
  const loginRouter = express.Router();
  loginRouter.use(express.urlencoded({ extended: false }));
  loginRouter.post('/authorize/login', (req, res) => {
    const { password, client_id, redirect_uri, state, code_challenge, resource, scope } = req.body;

    const hidden = { client_id, redirect_uri, state, code_challenge, resource, scope };

    if (client_id !== client.client_id || !redirectUris.includes(redirect_uri)) {
      res.status(400).send('Invalid authorization request.');
      return;
    }

    if (password !== loginPassword) {
      res.status(401).send(loginPage({ action: '/authorize/login', hidden, error: 'Incorrect password.' }));
      return;
    }

    prune(codes);
    const code = newToken();
    codes.set(code, {
      codeChallenge: code_challenge,
      clientId: client_id,
      redirectUri: redirect_uri,
      scopes: scope ? scope.split(' ') : [],
      resource: resource || undefined,
      expiresAt: Date.now() + CODE_TTL_MS,
    });

    const redirect = new URL(redirect_uri);
    redirect.searchParams.set('code', code);
    if (state) redirect.searchParams.set('state', state);
    res.redirect(302, redirect.href);
  });

  /** @type {import('@modelcontextprotocol/sdk/server/auth/provider.js').OAuthServerProvider} */
  const provider = {
    clientsStore,

    async authorize(authClient, params, res) {
      const hidden = {
        client_id: authClient.client_id,
        redirect_uri: params.redirectUri,
        state: params.state,
        code_challenge: params.codeChallenge,
        resource: params.resource ? params.resource.href : undefined,
        scope: params.scopes && params.scopes.length ? params.scopes.join(' ') : undefined,
      };
      res.status(200).send(loginPage({ action: '/authorize/login', hidden }));
    },

    async challengeForAuthorizationCode(authClient, authorizationCode) {
      const entry = codes.get(authorizationCode);
      if (!entry || entry.expiresAt < Date.now() || entry.clientId !== authClient.client_id) {
        throw new InvalidGrantError('Invalid or expired authorization code');
      }
      return entry.codeChallenge;
    },

    async exchangeAuthorizationCode(authClient, authorizationCode) {
      const entry = codes.get(authorizationCode);
      if (!entry || entry.expiresAt < Date.now() || entry.clientId !== authClient.client_id) {
        throw new InvalidGrantError('Invalid or expired authorization code');
      }
      codes.delete(authorizationCode);

      prune(accessTokens);
      prune(refreshTokens);

      const accessToken = newToken();
      const refreshToken = newToken();
      const now = Date.now();
      accessTokens.set(accessToken, {
        clientId: authClient.client_id,
        scopes: entry.scopes,
        resource: entry.resource,
        expiresAt: now + ACCESS_TOKEN_TTL_MS,
      });
      refreshTokens.set(refreshToken, {
        clientId: authClient.client_id,
        scopes: entry.scopes,
        resource: entry.resource,
        expiresAt: now + REFRESH_TOKEN_TTL_MS,
      });

      return {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
        refresh_token: refreshToken,
        scope: entry.scopes.join(' ') || undefined,
      };
    },

    async exchangeRefreshToken(authClient, refreshToken, scopes) {
      const entry = refreshTokens.get(refreshToken);
      if (!entry || entry.expiresAt < Date.now() || entry.clientId !== authClient.client_id) {
        throw new InvalidGrantError('Invalid or expired refresh token');
      }

      prune(accessTokens);

      const accessToken = newToken();
      accessTokens.set(accessToken, {
        clientId: authClient.client_id,
        scopes: scopes || entry.scopes,
        resource: entry.resource,
        expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS,
      });

      return {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
        refresh_token: refreshToken,
        scope: (scopes || entry.scopes).join(' ') || undefined,
      };
    },

    async verifyAccessToken(token) {
      const entry = accessTokens.get(token);
      if (!entry || entry.expiresAt < Date.now()) {
        throw new InvalidTokenError('Invalid or expired access token');
      }
      return {
        token,
        clientId: entry.clientId,
        scopes: entry.scopes,
        expiresAt: Math.floor(entry.expiresAt / 1000),
        resource: entry.resource ? new URL(entry.resource) : undefined,
      };
    },

    async revokeToken(authClient, request) {
      accessTokens.delete(request.token);
      refreshTokens.delete(request.token);
    },
  };

  return { provider, loginRouter };
}

module.exports = { createAuthProvider };
