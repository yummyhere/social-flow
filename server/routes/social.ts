import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config.ts';
import { query, get, run } from '../db.ts';
import { metaService } from '../metaService.ts';
import { encryptToken, decryptToken, generateSecureState } from '../crypto.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

// 1. Initiate Meta OAuth Connection
router.get('/connect/meta', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!config.meta.isConfigured) {
      res.status(400).json({
        error: 'Meta credentials not configured in environment variables (META_APP_ID, META_APP_SECRET).',
        isConfigured: false,
      });
      return;
    }

    const state = generateSecureState();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    run(
      `INSERT INTO oauth_states (state, user_id, platform, expires_at, is_used) 
       VALUES (?, ?, 'meta', ?, 0)`,
      [state, req.user!.id, expiresAt]
    );

    const authUrl = metaService.getAuthorizationUrl(state);
    res.json({ authUrl, state });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to initiate Meta connection' });
  }
});

// 2. Meta OAuth Callback (handles browser redirect from Facebook)
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    res.redirect(`${config.appUrl}/accounts?error=${encodeURIComponent(String(error_description || error))}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${config.appUrl}/accounts?error=Missing+code+or+state+parameter`);
    return;
  }

  try {
    // Validate state
    const oauthState = get<any>(
      `SELECT * FROM oauth_states WHERE state = ? AND is_used = 0 AND expires_at > ?`,
      [String(state), Date.now()]
    );

    if (!oauthState) {
      res.redirect(`${config.appUrl}/accounts?error=Invalid+or+expired+OAuth+session.+Please+try+again.`);
      return;
    }

    // Mark state as used
    run(`UPDATE oauth_states SET is_used = 1 WHERE state = ?`, [String(state)]);

    const userId = oauthState.user_id;

    // Exchange code for user token
    const userAccessToken = await metaService.exchangeCodeForToken(String(code));

    // Fetch user Facebook Pages and connected Instagram accounts
    const pages = await metaService.fetchUserPages(userAccessToken);

    const nowIso = new Date().toISOString();

    for (const page of pages) {
      // 1. Save Facebook Page
      const encryptedPageToken = encryptToken(page.accessToken);
      const fbAccountId = crypto.randomUUID();

      run(
        `INSERT INTO social_accounts 
         (id, user_id, platform, platform_account_id, display_name, account_type, encrypted_access_token, token_iv, token_tag, connection_status, last_connection_check, created_at, updated_at)
         VALUES (?, ?, 'facebook', ?, ?, 'facebook_page', ?, ?, ?, 'active', ?, ?, ?)
         ON CONFLICT(user_id, platform, platform_account_id) DO UPDATE SET
           display_name = excluded.display_name,
           encrypted_access_token = excluded.encrypted_access_token,
           token_iv = excluded.token_iv,
           token_tag = excluded.token_tag,
           connection_status = 'active',
           last_connection_check = excluded.last_connection_check,
           updated_at = excluded.updated_at`,
        [
          fbAccountId,
          userId,
          page.id,
          page.name,
          encryptedPageToken.ciphertext,
          encryptedPageToken.iv,
          encryptedPageToken.tag,
          nowIso,
          nowIso,
          nowIso,
        ]
      );

      // 2. If connected Instagram Business account exists, save it too!
      if (page.instagramBusinessAccount) {
        const ig = page.instagramBusinessAccount;
        const igAccountId = crypto.randomUUID();
        // Instagram uses the Page Access Token to publish via Graph API
        const encryptedIgToken = encryptToken(page.accessToken);

        run(
          `INSERT INTO social_accounts 
           (id, user_id, platform, platform_account_id, display_name, account_type, encrypted_access_token, token_iv, token_tag, connection_status, last_connection_check, avatar_url, created_at, updated_at)
           VALUES (?, ?, 'instagram', ?, ?, 'instagram_business', ?, ?, ?, 'active', ?, ?, ?, ?)
           ON CONFLICT(user_id, platform, platform_account_id) DO UPDATE SET
             display_name = excluded.display_name,
             encrypted_access_token = excluded.encrypted_access_token,
             token_iv = excluded.token_iv,
             token_tag = excluded.token_tag,
             connection_status = 'active',
             last_connection_check = excluded.last_connection_check,
             avatar_url = excluded.avatar_url,
             updated_at = excluded.updated_at`,
          [
            igAccountId,
            userId,
            ig.id,
            ig.username ? `@${ig.username}` : ig.name || 'Instagram Account',
            encryptedIgToken.ciphertext,
            encryptedIgToken.iv,
            encryptedIgToken.tag,
            nowIso,
            ig.profilePictureUrl || null,
            nowIso,
            nowIso,
          ]
        );
      }
    }

    res.redirect(`${config.appUrl}/accounts?success=true&connected=${pages.length}`);
  } catch (err: any) {
    console.error('Meta OAuth callback error:', err);
    res.redirect(`${config.appUrl}/accounts?error=${encodeURIComponent(err.message || 'OAuth verification failed')}`);
  }
});

// 3. Connect via Direct Meta Token (For development, manual Page Access Token, or system user tokens)
router.post('/connect-token', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token, platform, accountId, displayName } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Access token is required.' });
      return;
    }

    const userId = req.user!.id;
    const nowIso = new Date().toISOString();

    // Verify token validity against Meta Graph API if config exists, or test payload
    let resolvedId = accountId;
    let resolvedName = displayName;
    let resolvedType = platform === 'instagram' ? 'instagram_business' : 'facebook_page';

    if (config.meta.isConfigured) {
      const debug = await metaService.debugToken(token);
      if (!debug.isValid && debug.error) {
        res.status(400).json({ error: `Meta rejected token: ${debug.error}` });
        return;
      }
    }

    // If accountId or displayName is missing, query Meta Graph API /me with token to get real Page ID and name
    if (!resolvedId || !resolvedName) {
      try {
        const meRes = await fetch(
          `https://graph.facebook.com/${config.meta.apiVersion}/me?fields=id,name&access_token=${encodeURIComponent(token)}`
        );
        const meJson = await meRes.json();
        if (meJson && meJson.id) {
          if (!resolvedId) resolvedId = meJson.id;
          if (!resolvedName) resolvedName = meJson.name;
        }
      } catch (e) {
        console.warn('Auto-resolving Page ID from /me failed:', e);
      }
    }

    if (!resolvedId) {
      resolvedId = `id-${crypto.randomBytes(6).toString('hex')}`;
    }
    if (!resolvedName) {
      resolvedName = platform === 'instagram' ? '@creator_account' : 'Official Page';
    }

    const encrypted = encryptToken(token);
    const newId = crypto.randomUUID();

    run(
      `INSERT INTO social_accounts 
       (id, user_id, platform, platform_account_id, display_name, account_type, encrypted_access_token, token_iv, token_tag, connection_status, last_connection_check, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
       ON CONFLICT(user_id, platform, platform_account_id) DO UPDATE SET
         display_name = excluded.display_name,
         encrypted_access_token = excluded.encrypted_access_token,
         token_iv = excluded.token_iv,
         token_tag = excluded.token_tag,
         connection_status = 'active',
         last_connection_check = excluded.last_connection_check,
         updated_at = excluded.updated_at`,
      [
        newId,
        userId,
        platform || 'facebook',
        resolvedId,
        resolvedName,
        resolvedType,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        nowIso,
        nowIso,
        nowIso,
      ]
    );

    res.status(201).json({
      message: 'Account connected successfully.',
      account: {
        id: newId,
        platform: platform || 'facebook',
        platform_account_id: resolvedId,
        display_name: resolvedName,
        account_type: resolvedType,
        connection_status: 'active',
        last_connection_check: nowIso,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to connect token' });
  }
});

// 4. List Connected Accounts (Never exposes tokens!)
router.get('/accounts', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const accounts = query<any>(
    `SELECT id, platform, platform_account_id, display_name, account_type, connection_status, 
            last_connection_check, avatar_url, created_at, updated_at
     FROM social_accounts 
     WHERE user_id = ? 
     ORDER BY created_at DESC`,
    [userId]
  );

  res.json({ accounts });
});

// 5. Verify & Health Check Account Connection
router.post('/accounts/:id/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const accountId = req.params.id;

  const account = get<any>(
    `SELECT * FROM social_accounts WHERE id = ? AND user_id = ?`,
    [accountId, userId]
  );

  if (!account) {
    res.status(404).json({ error: 'Social account not found.' });
    return;
  }

  try {
    let token: string;
    try {
      token = decryptToken({
        ciphertext: account.encrypted_access_token,
        iv: account.token_iv,
        tag: account.token_tag,
      });
    } catch {
      run(`UPDATE social_accounts SET connection_status = 'error', updated_at = ? WHERE id = ?`, [
        new Date().toISOString(),
        accountId,
      ]);
      res.json({
        status: 'error',
        message: 'Stored token decryption failed. Please reconnect the account.',
      });
      return;
    }

    const debug = await metaService.debugToken(token);
    const nowIso = new Date().toISOString();
    const newStatus = debug.isValid ? 'active' : 'expired';

    run(
      `UPDATE social_accounts 
       SET connection_status = ?, last_connection_check = ?, updated_at = ? 
       WHERE id = ?`,
      [newStatus, nowIso, nowIso, accountId]
    );

    res.json({
      status: newStatus,
      debug,
      lastCheck: nowIso,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// 6. Disconnect Account
router.delete('/accounts/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const accountId = req.params.id;

  const existing = get(`SELECT id FROM social_accounts WHERE id = ? AND user_id = ?`, [accountId, userId]);
  if (!existing) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }

  run(`DELETE FROM social_accounts WHERE id = ? AND user_id = ?`, [accountId, userId]);
  res.json({ message: 'Social account disconnected and credentials safely deleted.' });
});

export default router;
