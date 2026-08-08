/**
 * routes/accounts.js — Gmail account management + OAuth2 flow.
 *
 * Endpoints:
 *   GET    /api/accounts           → List all connected accounts
 *   POST   /api/accounts/auth-url  → Get Google OAuth consent URL
 *   GET    /api/accounts/callback  → Handle OAuth callback
 *   DELETE /api/accounts/:id       → Remove an account
 *   POST   /api/accounts/:id/test  → Send a test email
 */

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const { getDb } = require('../db');

// Cache SMTP transports per account to reuse connections and enable pooling
const transportCache = new Map();
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOAuth2Client(customRedirectUri) {
  const redirectUri = customRedirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/accounts/callback';
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

/**
 * Refresh the access token for an account if it has expired.
 * Returns the (possibly refreshed) access_token.
 */
async function ensureFreshToken(account) {
  if (!account) throw new Error('No account provided to ensureFreshToken');
  const now = Date.now();
  const expiry = account.token_expiry ? Number(account.token_expiry) : 0;
  
  // If access_token exists and token_expiry is valid in the future (with 1-min buffer), reuse access_token
  if (account.access_token && expiry && now < expiry - 60000) {
    return account.access_token;
  }

  // If no refresh_token is saved, fallback to access_token if present
  if (!account.refresh_token) {
    if (account.access_token) return account.access_token;
    throw new Error(`Account ${account.email} has no refresh token. Please reconnect this account via Google OAuth.`);
  }

  try {
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({ refresh_token: account.refresh_token });

    let tokenResult;
    if (typeof oauth2.refreshAccessToken === 'function') {
      tokenResult = await oauth2.refreshAccessToken();
      tokenResult = tokenResult && tokenResult.credentials ? tokenResult.credentials : tokenResult;
    } else {
      tokenResult = await oauth2.getAccessToken();
    }

    const newAccessToken = typeof tokenResult === 'string'
      ? tokenResult
      : tokenResult?.token || tokenResult?.access_token || account.access_token;
    const newExpiry = tokenResult?.res?.data?.expiry_date || tokenResult?.expiry_date || account.token_expiry || (Date.now() + 3600 * 1000);

    if (!newAccessToken) {
      throw new Error(`Unable to refresh access token for account ${account.email}.`);
    }

    const db = await getDb();
    await db.prepare(`
      UPDATE accounts
      SET access_token  = ?,
          token_expiry  = ?
      WHERE id = ?
    `).run(newAccessToken, newExpiry, account.id);

    return newAccessToken;
  } catch (err) {
    if (account.access_token) {
      return account.access_token;
    }
    throw err;
  }
}


/**
 * Create a Nodemailer transport from an SMTP account row.
 */
function createSmtpTransport(account) {
  // If account object has an id, cache the transport to reuse connections
  try {
    const key = account && account.id ? String(account.id) : null;
    if (key && transportCache.has(key)) return transportCache.get(key);

    const transport = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port || 587,
      secure: !!account.smtp_secure, // true = SSL/TLS (465), false = STARTTLS
      auth: {
        user: account.smtp_user,
        pass: account.smtp_pass,
      },
      // Enable pooling to avoid reconnect on every send
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    if (key) transportCache.set(key, transport);
    return transport;
  } catch (err) {
    // Fallback to simple transport if something goes wrong
    return nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port || 587,
      secure: !!account.smtp_secure,
      auth: { user: account.smtp_user, pass: account.smtp_pass },
    });
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** List all accounts. */
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const accounts = await db.prepare(`
      SELECT id, email, status, daily_sent, daily_limit, last_reset, display_name,
             type, smtp_host, smtp_port, smtp_secure, created_at
      FROM accounts
    `).all();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Generate Google OAuth consent URL. */
router.post('/auth-url', (req, res) => {
  try {
    let customRedirectUri = req.body?.redirect_uri;
    if (!customRedirectUri && req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1'))) {
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      customRedirectUri = `${protocol}://${req.headers.host}/api/accounts/callback`;
    }

    const oauth2 = getOAuth2Client(customRedirectUri);
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** OAuth callback — exchange code for tokens, save account. */
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided.' });

  try {
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Fetch the email address
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data } = await oauth2Api.userinfo.get();
    const email = data.email;

    const db = await getDb();
    const existing = await db.prepare('SELECT id FROM accounts WHERE email = ?').get(email);

    if (existing) {
      await db.prepare(`
        UPDATE accounts
        SET access_token  = ?,
            refresh_token = COALESCE(?, refresh_token),
            token_expiry  = ?,
            status        = 'active',
            type          = 'oauth'
        WHERE email = ?
      `).run(tokens.access_token, tokens.refresh_token, tokens.expiry_date, email);
    } else {
      await db.prepare(`
        INSERT INTO accounts (email, access_token, refresh_token, token_expiry, type)
        VALUES (?, ?, ?, ?, 'oauth')
      `).run(email, tokens.access_token, tokens.refresh_token, tokens.expiry_date);
    }

    // Return a beautiful self-closing HTML success page
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Connected | Peak Xender</title>
        <style>
          body {
            background: radial-gradient(circle at center, #0f172a, #020617);
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            overflow: hidden;
          }
          .card {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 24px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            position: relative;
          }
          .card::before {
            content: '';
            position: absolute;
            top: -2px; left: -2px; right: -2px; bottom: -2px;
            background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899);
            border-radius: 26px;
            z-index: -1;
            opacity: 0.15;
          }
          .icon-container {
            width: 72px;
            height: 72px;
            border-radius: 20px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            color: #10b981;
          }
          h2 {
            font-size: 22px;
            font-weight: 800;
            margin: 0 0 12px;
            background: linear-gradient(to right, #ffffff, #cbd5e1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            color: #94a3b8;
            font-size: 14px;
            line-height: 1.6;
            margin: 0 0 24px;
          }
          .email {
            font-family: monospace;
            color: #818cf8;
            background: rgba(129, 140, 248, 0.1);
            padding: 4px 10px;
            border-radius: 8px;
            border: 1px solid rgba(129, 140, 248, 0.2);
          }
          .countdown {
            font-size: 12px;
            color: #64748b;
          }
          .btn {
            background: linear-gradient(to right, #4f46e5, #7c3aed);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 12px 24px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
            transition: all 0.2s;
          }
          .btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 20px -3px rgba(79, 70, 229, 0.4);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon-container">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h2>Connection Successful</h2>
          <p>The Gmail account <span class="email">${email}</span> has been connected to Peak Xender.</p>
          <button class="btn" onclick="window.close()">Close Window</button>
          <div class="countdown" style="margin-top: 20px;">Closing automatically in <span id="secs">4</span>s...</div>
        </div>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', email: '${email}' }, '*');
            }
          } catch (e) {}

          let secs = 4;
          const interval = setInterval(() => {
            secs--;
            document.getElementById('secs').textContent = secs;
            if (secs <= 0) {
              clearInterval(interval);
              window.close();
            }
          }, 1000);
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    const logger = require('../logger');
    logger.error({ err: err.message }, 'OAuth callback error');
    
    // Return a beautiful self-closing HTML error page
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Connection Failed | Peak Xender</title>
        <style>
          body {
            background: radial-gradient(circle at center, #0f172a, #020617);
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            overflow: hidden;
          }
          .card {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 24px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            position: relative;
          }
          .card::before {
            content: '';
            position: absolute;
            top: -2px; left: -2px; right: -2px; bottom: -2px;
            background: linear-gradient(135deg, #ef4444, #f97316);
            border-radius: 26px;
            z-index: -1;
            opacity: 0.15;
          }
          .icon-container {
            width: 72px;
            height: 72px;
            border-radius: 20px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            color: #ef4444;
          }
          h2 {
            font-size: 22px;
            font-weight: 800;
            margin: 0 0 12px;
            background: linear-gradient(to right, #ffffff, #cbd5e1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            color: #94a3b8;
            font-size: 14px;
            line-height: 1.6;
            margin: 0 0 24px;
          }
          .error-msg {
            font-family: monospace;
            color: #f87171;
            background: rgba(239, 68, 68, 0.05);
            padding: 10px;
            border-radius: 8px;
            border: 1px solid rgba(239, 68, 68, 0.1);
            word-break: break-all;
            max-height: 120px;
            overflow-y: auto;
          }
          .btn {
            background: #334155;
            color: white;
            border: none;
            border-radius: 12px;
            padding: 12px 24px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn:hover {
            background: #475569;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon-container">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2>Connection Failed</h2>
          <p>We could not link your Gmail account at this time.</p>
          <p class="error-msg">${err.message}</p>
          <button class="btn" onclick="window.close()">Close Window</button>
        </div>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: '${err.message.replace(/'/g, "\\'")}' }, '*');
            }
          } catch (e) {}
        </script>
      </body>
      </html>
    `);
  }
});

/** Connect a custom SMTP account. */
router.post('/smtp', async (req, res) => {
  const { email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, display_name } = req.body;

  if (!email || !smtp_host || !smtp_user || !smtp_pass) {
    return res.status(400).json({ error: 'Missing required SMTP fields (email, smtp_host, smtp_user, smtp_pass).' });
  }

  try {
    // Verify the connection before saving
    const transport = nodemailer.createTransport({
      host: smtp_host,
      port: smtp_port || 587,
      secure: !!smtp_secure,
      auth: { user: smtp_user, pass: smtp_pass },
    });

    await transport.verify();

    const db = await getDb();
    const existing = await db.prepare('SELECT id FROM accounts WHERE email = ?').get(email);

    if (existing) {
      await db.prepare(`
        UPDATE accounts
        SET type = 'smtp', smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?,
            smtp_secure = ?, display_name = COALESCE(?, display_name), status = 'active'
        WHERE email = ?
      `).run(smtp_host, smtp_port || 587, smtp_user, smtp_pass, smtp_secure ? 1 : 0, display_name || '', email);
    } else {
      await db.prepare(`
        INSERT INTO accounts (email, type, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, display_name)
        VALUES (?, 'smtp', ?, ?, ?, ?, ?, ?)
      `).run(email, smtp_host, smtp_port || 587, smtp_user, smtp_pass, smtp_secure ? 1 : 0, display_name || '');
    }

    res.json({ success: true, message: `SMTP account ${email} connected and verified.` });
  } catch (err) {
    res.status(400).json({ error: `SMTP verification failed: ${err.message}` });
  }
});

/** Delete an account. */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Pause an account. */
router.post('/:id/pause', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare("UPDATE accounts SET status = 'paused' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Resume an account. */
router.post('/:id/resume', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare("UPDATE accounts SET status = 'active' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Reset daily sent count. */
router.post('/:id/reset', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare("UPDATE accounts SET daily_sent = 0, last_reset = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update display name. */
router.put('/:id/display-name', async (req, res) => {
  const { display_name } = req.body;
  try {
    const db = await getDb();
    await db.prepare("UPDATE accounts SET display_name = ? WHERE id = ?").run(display_name || '', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Send a test email from a specific account (supports both OAuth and SMTP). */
router.post('/:id/test', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Missing "to" field.' });

  try {
    const db = await getDb();
    const account = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found.' });

    if (account.type === 'smtp') {
      // Send via Nodemailer SMTP
      const transport = createSmtpTransport(account);
      await transport.sendMail({
        from: account.display_name
          ? `"${account.display_name}" <${account.email}>`
          : account.email,
        to,
        subject: 'Peak Xender Test',
        html: '<p>This is a test email from Peak Xender via your custom SMTP server.</p>',
      });
    } else {
      // Send via Gmail API (OAuth)
      const accessToken = await ensureFreshToken(account);
      const oauth2 = getOAuth2Client();
      oauth2.setCredentials({ access_token: accessToken });

      const gmail = google.gmail({ version: 'v1', auth: oauth2 });
      const raw = makeRawEmail(account.email, to, 'Peak Xender Test', 'This is a test email from Peak Xender.');
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    }

    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Send a direct email immediately (bypassing campaign batch queue). */
router.post('/send-direct', async (req, res) => {
  const { account_id, to, subject, html_body, text_body } = req.body;
  if (!to || (!html_body && !text_body)) {
    return res.status(400).json({ error: 'Missing required fields: to and body.' });
  }

  try {
    const db = await getDb();
    let account;
    if (account_id) {
      account = await db.prepare("SELECT * FROM accounts WHERE id = ? AND status = 'active'").get(account_id);
    } else {
      account = await db.prepare("SELECT * FROM accounts WHERE status = 'active' ORDER BY id ASC LIMIT 1").get();
    }

    if (!account) {
      return res.status(400).json({ error: 'No active sender accounts found. Please connect an account first.' });
    }

    const emailSubject = subject || 'Direct Outreach';
    const emailBody = html_body || `<p>${(text_body || '').replace(/\n/g, '<br/>')}</p>`;
    const fromAddr = account.display_name ? `"${account.display_name}" <${account.email}>` : account.email;

    if (account.type === 'smtp') {
      const transport = createSmtpTransport(account);
      await transport.sendMail({
        from: fromAddr,
        to,
        subject: emailSubject,
        html: emailBody,
      });
    } else {
      const accessToken = await ensureFreshToken(account);
      const oauth2 = getOAuth2Client();
      oauth2.setCredentials({ access_token: accessToken });

      const gmail = google.gmail({ version: 'v1', auth: oauth2 });
      const raw = makeRawEmail(account.email, to, emailSubject, emailBody);
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    }

    // Update account daily count & write to logs table
    await db.prepare('UPDATE accounts SET daily_sent = daily_sent + 1 WHERE id = ?').run(account.id);
    await db.prepare(`
      INSERT INTO logs (account_id, recipient_email, status, message)
      VALUES (?, ?, 'sent', ?)
    `).run(account.id, to, `Direct email sent to ${to}`);

    res.json({ success: true, message: `Email sent immediately to ${to} via ${account.email}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Build a base64url-encoded RFC 2822 message with optional extra headers. */
function makeRawEmail(from, to, subject, body, extraHeaders = {}) {
  const cleanSubject = /[^\x00-\x7F]/.test(subject || '')
    ? `=?UTF-8?B?${Buffer.from(subject || '', 'utf-8').toString('base64')}?=`
    : (subject || '');

  const headerLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${cleanSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ];

  // Append any extra headers (e.g., List-Unsubscribe)
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value) {
      headerLines.push(`${key}: ${value}`);
    }
  }

  const msg = [...headerLines, '', body || ''].join('\r\n');
  return Buffer.from(msg, 'utf-8').toString('base64url');
}

// Export the helper for the scheduler
router.ensureFreshToken = ensureFreshToken;
router.makeRawEmail = makeRawEmail;
router.getOAuth2Client = getOAuth2Client;
router.createSmtpTransport = createSmtpTransport;

module.exports = router;
