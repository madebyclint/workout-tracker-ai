/**
 * mcp/auth.js
 *
 * Single-user OAuth 2.1 authorization server for the /mcp connector.
 *
 * Supports Dynamic Client Registration (RFC 7591): claude.ai self-registers
 * when you add the connector, so there's no client ID/secret to generate
 * or paste, and no redirect_uri to configure ahead of time — the client
 * declares its own redirect_uris at registration time and the SDK validates
 * against those automatically.
 *
 * There's still exactly one trusted human, though, and no existing account
 * system to piggyback on — so "login" is a single shared password gate on
 * /authorize (separate from the OAuth client credentials above).
 *
 * Clients/codes/tokens are persisted in Postgres (oauth_clients/oauth_codes/
 * oauth_tokens — see db/schema.sql), not memory: a redeploy restarts the
 * process, and an in-memory store would silently drop every registered
 * client and issued token on every push, forcing claude.ai to re-register
 * and you to re-authorize each time. Access/refresh tokens are stored as
 * SHA-256 hashes; client_secret is stored as-is since the SDK's own client
 * auth middleware compares it directly.
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

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
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

function rowToClient(row) {
  if (!row) return undefined;
  return {
    client_id: row.client_id,
    client_secret: row.client_secret || undefined,
    redirect_uris: row.redirect_uris,
    grant_types: row.grant_types || undefined,
    response_types: row.response_types || undefined,
    token_endpoint_auth_method: row.token_endpoint_auth_method || undefined,
    client_name: row.client_name || undefined,
    client_id_issued_at: row.client_id_issued_at != null ? Number(row.client_id_issued_at) : undefined,
    client_secret_expires_at: row.client_secret_expires_at != null ? Number(row.client_secret_expires_at) : undefined,
  };
}

/**
 * @param {object} opts
 * @param {string} opts.loginPassword
 * @param {import('pg').Pool} opts.pool
 */
function createAuthProvider({ loginPassword, pool }) {
  const clientsStore = {
    async getClient(id) {
      const result = await pool.query('SELECT * FROM oauth_clients WHERE client_id = $1', [id]);
      return rowToClient(result.rows[0]);
    },
    async registerClient(clientInfo) {
      await pool.query(
        `INSERT INTO oauth_clients
           (client_id, client_secret, redirect_uris, grant_types, response_types,
            token_endpoint_auth_method, client_name, client_id_issued_at, client_secret_expires_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9)`,
        [
          clientInfo.client_id,
          clientInfo.client_secret || null,
          JSON.stringify(clientInfo.redirect_uris),
          JSON.stringify(clientInfo.grant_types || []),
          JSON.stringify(clientInfo.response_types || []),
          clientInfo.token_endpoint_auth_method || null,
          clientInfo.client_name || null,
          clientInfo.client_id_issued_at || null,
          clientInfo.client_secret_expires_at || null,
        ]
      );
      return clientInfo;
    },
  };

  // Router mounted alongside mcpAuthRouter for the password-check POST that
  // actually issues the code + redirect. Kept separate from provider.authorize()
  // because the SDK's authorize handler only passes (client, params, res) to
  // that method — no access to the submitted password field.
  const loginRouter = express.Router();
  loginRouter.use(express.urlencoded({ extended: false }));
  loginRouter.post('/authorize/login', async (req, res) => {
    const { password, client_id, redirect_uri, state, code_challenge, resource, scope } = req.body;

    const hidden = { client_id, redirect_uri, state, code_challenge, resource, scope };

    const client = await clientsStore.getClient(client_id);
    if (!client || !client.redirect_uris.includes(redirect_uri)) {
      res.status(400).send('Invalid authorization request.');
      return;
    }

    if (password !== loginPassword) {
      res.status(401).send(loginPage({ action: '/authorize/login', hidden, error: 'Incorrect password.' }));
      return;
    }

    await pool.query('DELETE FROM oauth_codes WHERE expires_at < NOW()');
    const code = newToken();
    await pool.query(
      `INSERT INTO oauth_codes (code, client_id, code_challenge, redirect_uri, scopes, resource, expires_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        code,
        client_id,
        code_challenge,
        redirect_uri,
        JSON.stringify(scope ? scope.split(' ') : []),
        resource || null,
        new Date(Date.now() + CODE_TTL_MS),
      ]
    );

    const redirect = new URL(redirect_uri);
    redirect.searchParams.set('code', code);
    if (state) redirect.searchParams.set('state', state);
    res.redirect(302, redirect.href);
  });

  async function issueTokenPair(clientId, scopes, resource) {
    await pool.query("DELETE FROM oauth_tokens WHERE expires_at < NOW()");

    const accessToken = newToken();
    const refreshToken = newToken();
    const now = Date.now();

    await pool.query(
      `INSERT INTO oauth_tokens (token_hash, token_type, client_id, scopes, resource, expires_at)
       VALUES ($1, 'access', $2, $3::jsonb, $4, $5)`,
      [hashToken(accessToken), clientId, JSON.stringify(scopes), resource || null, new Date(now + ACCESS_TOKEN_TTL_MS)]
    );
    await pool.query(
      `INSERT INTO oauth_tokens (token_hash, token_type, client_id, scopes, resource, expires_at)
       VALUES ($1, 'refresh', $2, $3::jsonb, $4, $5)`,
      [hashToken(refreshToken), clientId, JSON.stringify(scopes), resource || null, new Date(now + REFRESH_TOKEN_TTL_MS)]
    );

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: scopes.join(' ') || undefined,
    };
  }

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
      const result = await pool.query(
        'SELECT code_challenge FROM oauth_codes WHERE code = $1 AND client_id = $2 AND expires_at > NOW()',
        [authorizationCode, authClient.client_id]
      );
      if (!result.rows.length) throw new InvalidGrantError('Invalid or expired authorization code');
      return result.rows[0].code_challenge;
    },

    async exchangeAuthorizationCode(authClient, authorizationCode) {
      const result = await pool.query(
        'DELETE FROM oauth_codes WHERE code = $1 AND client_id = $2 AND expires_at > NOW() RETURNING scopes, resource',
        [authorizationCode, authClient.client_id]
      );
      if (!result.rows.length) throw new InvalidGrantError('Invalid or expired authorization code');
      const { scopes, resource } = result.rows[0];
      return issueTokenPair(authClient.client_id, scopes, resource);
    },

    async exchangeRefreshToken(authClient, refreshToken, scopes) {
      const result = await pool.query(
        "SELECT scopes, resource FROM oauth_tokens WHERE token_hash = $1 AND token_type = 'refresh' AND client_id = $2 AND expires_at > NOW()",
        [hashToken(refreshToken), authClient.client_id]
      );
      if (!result.rows.length) throw new InvalidGrantError('Invalid or expired refresh token');
      const entry = result.rows[0];

      const accessToken = newToken();
      await pool.query(
        `INSERT INTO oauth_tokens (token_hash, token_type, client_id, scopes, resource, expires_at)
         VALUES ($1, 'access', $2, $3::jsonb, $4, $5)`,
        [hashToken(accessToken), authClient.client_id, JSON.stringify(scopes || entry.scopes), entry.resource, new Date(Date.now() + ACCESS_TOKEN_TTL_MS)]
      );

      return {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
        refresh_token: refreshToken,
        scope: (scopes || entry.scopes).join(' ') || undefined,
      };
    },

    async verifyAccessToken(token) {
      const result = await pool.query(
        "SELECT client_id, scopes, resource, expires_at FROM oauth_tokens WHERE token_hash = $1 AND token_type = 'access' AND expires_at > NOW()",
        [hashToken(token)]
      );
      if (!result.rows.length) throw new InvalidTokenError('Invalid or expired access token');
      const entry = result.rows[0];
      return {
        token,
        clientId: entry.client_id,
        scopes: entry.scopes,
        expiresAt: Math.floor(new Date(entry.expires_at).getTime() / 1000),
        resource: entry.resource ? new URL(entry.resource) : undefined,
      };
    },

    async revokeToken(authClient, request) {
      await pool.query('DELETE FROM oauth_tokens WHERE token_hash = $1 AND client_id = $2', [hashToken(request.token), authClient.client_id]);
    },
  };

  return {
    provider,
    loginRouter,
    // clientSecretExpirySeconds: 0 disables client-secret expiry — a
    // dynamically registered client re-expiring every 30 days (the SDK
    // default) would otherwise force claude.ai to silently re-register
    // periodically for no real security benefit at this scale.
    clientRegistrationOptions: { clientSecretExpirySeconds: 0 },
  };
}

module.exports = { createAuthProvider };
