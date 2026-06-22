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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Refresh the access token for an account if it has expired.
 * Returns the (possibly refreshed) access_token.
 */
async function ensureFreshToken(account) {
  const now = Date.now();
  const expiry = account.token_expiry ? Number(account.token_expiry) : 0;
  if (expiry && now < expiry - 60000) {
    return account.access_token; // Still valid
  }

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: account.refresh_token });
  const { credentials } = await oauth2.refreshAccessToken();

  const db = await getDb();
  await db.prepare(`
    UPDATE accounts
    SET access_token  = ?,
        token_expiry  = ?
    WHERE id = ?
  `).run(credentials.access_token, credentials.expiry_date, account.id);

  return credentials.access_token;
}

/**
 * Create a Nodemailer transport from an SMTP account row.
 */
function createSmtpTransport(account) {
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port || 587,
    secure: !!account.smtp_secure, // true = SSL/TLS (465), false = STARTTLS
    auth: {
      user: account.smtp_user,
      pass: account.smtp_pass,
    },
  });
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
router.post('/auth-url', (_req, res) => {
  try {
    const oauth2 = getOAuth2Client();
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

    // Redirect back to the frontend dashboard
    res.redirect('/?account_added=' + encodeURIComponent(email));
  } catch (err) {
    const logger = require('../logger');
    logger.error({ err: err.message }, 'OAuth callback error');
    res.redirect('/?account_error=' + encodeURIComponent(err.message));
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

/** Build a base64url-encoded RFC 2822 message with optional extra headers. */
function makeRawEmail(from, to, subject, body, extraHeaders = {}) {
  const headerLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ];

  // Append any extra headers (e.g., List-Unsubscribe)
  for (const [key, value] of Object.entries(extraHeaders)) {
    headerLines.push(`${key}: ${value}`);
  }

  const msg = [...headerLines, '', body].join('\r\n');
  return Buffer.from(msg).toString('base64url');
}

// Export the helper for the scheduler
router.ensureFreshToken = ensureFreshToken;
router.makeRawEmail = makeRawEmail;
router.getOAuth2Client = getOAuth2Client;
router.createSmtpTransport = createSmtpTransport;

module.exports = router;
