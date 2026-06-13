/**
 * scheduler.js — Background email worker.
 *
 * Runs every 10 seconds via node-cron.
 * Picks the next pending queue item, checks the sending window,
 * sends the email via Gmail API, and updates the queue/campaign status.
 *
 * Round-robin account rotation is pre-assigned at campaign launch time,
 * so this worker just processes each item with its assigned account.
 */

const cron = require('node-cron');
const { google } = require('googleapis');
const { getDb } = require('./db');

// Import helpers from the accounts route
const {
  ensureFreshToken,
  makeRawEmail,
  getOAuth2Client,
  createSmtpTransport,
} = require('./routes/accounts');

// ---------------------------------------------------------------------------
// Sending-window check
// ---------------------------------------------------------------------------

/**
 * Check if the current time is within the campaign's allowed sending window.
 */
function isWithinSendingWindow(campaign) {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes;

  const [startH, startM] = (campaign.start_time || '08:00').split(':').map(Number);
  const [endH, endM] = (campaign.end_time || '22:00').split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentTime >= startMinutes && currentTime <= endMinutes;
}

// ---------------------------------------------------------------------------
// Content variation (spintax-like rotation)
// ---------------------------------------------------------------------------

/**
 * If campaign has content_variations, pick one based on the queue item index.
 * Returns { subject, body_html }.
 */
function getContent(campaign, queueItem) {
  if (campaign.content_mode !== 'rotation' || !campaign.content_variations) {
    return {
      subject: campaign.subject,
      body_html: campaign.body_html,
    };
  }

  try {
    const variations = JSON.parse(campaign.content_variations);
    if (!Array.isArray(variations) || variations.length === 0) {
      return { subject: campaign.subject, body_html: campaign.body_html };
    }
    const index = (queueItem.id - 1) % variations.length;
    const v = variations[index];
    return {
      subject: v.subject || campaign.subject,
      body_html: v.body_html || campaign.body_html,
    };
  } catch {
    return { subject: campaign.subject, body_html: campaign.body_html };
  }
}

/**
 * Simple template variable replacement.
 * Supports {{email}} and {{date}}.
 */
function personalise(text, recipient) {
  if (!text) return text;
  const now = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  return text
    .replace(/\{\{email\}\}/gi, recipient)
    .replace(/\{\{date\}\}/gi, now);
}

/**
 * Parses the HTML email body, wraps outbound links in redirect tracking URLs,
 * and appends a hidden 1x1 image tracking pixel.
 */
function injectTracking(bodyHtml, queueItemId) {
  if (!bodyHtml) return bodyHtml;
  const baseUrl = process.env.TRACKING_BASE_URL || 'http://localhost:3000';

  // Match href="url" or href='url'
  let trackedBody = bodyHtml.replace(/href=(["'])([^"'\s>]+)\1/gi, (match, quote, url) => {
    // Skip anchor tags, email links, phone links, and existing track routes
    if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.includes('/api/track/')) {
      return match;
    }
    const wrappedUrl = `${baseUrl}/api/track/click/${queueItemId}?url=${encodeURIComponent(url)}`;
    return `href=${quote}${wrappedUrl}${quote}`;
  });

  // Inject open tracking pixel
  const pixelUrl = `${baseUrl}/api/track/open/${queueItemId}`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;

  if (trackedBody.includes('</body>')) {
    trackedBody = trackedBody.replace('</body>', `${pixelTag}</body>`);
  } else {
    trackedBody += pixelTag;
  }

  return trackedBody;
}

// ---------------------------------------------------------------------------
// Send one email
// ---------------------------------------------------------------------------

async function sendEmail(account, to, subject, bodyHtml) {
  if (account.type === 'smtp') {
    // Send via Nodemailer SMTP transport
    const transport = createSmtpTransport(account);
    await transport.sendMail({
      from: account.display_name
        ? `"${account.display_name}" <${account.email}>`
        : account.email,
      to,
      subject,
      html: bodyHtml,
    });
  } else {
    // Send via Gmail API (OAuth)
    const accessToken = await ensureFreshToken(account);
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const raw = makeRawEmail(account.email, to, subject, bodyHtml);

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
  }
}

// ---------------------------------------------------------------------------
// Process one queue item
// ---------------------------------------------------------------------------

async function processNextItem() {
  let db;
  try {
    db = await getDb();
  } catch (err) {
    console.error('[Scheduler] DB not ready:', err.message);
    return;
  }

  // Find the next pending item whose scheduled time has passed
  const item = db.prepare(`
    SELECT q.*, c.status as campaign_status,
           c.subject as c_subject, c.body_html as c_body_html,
           c.start_time, c.end_time,
           c.content_variations, c.content_mode
    FROM queue q
    JOIN campaigns c ON q.campaign_id = c.id
    WHERE q.status = 'pending'
      AND c.status = 'sending'
      AND q.scheduled_at <= datetime('now')
    ORDER BY q.scheduled_at ASC
    LIMIT 1
  `).get();

  if (!item) return; // Nothing to send

  // Check sending window
  if (!isWithinSendingWindow(item)) {
    return; // Outside allowed hours
  }

  // Get the assigned sender account
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(item.account_id);
  if (!account || account.status !== 'active') {
    // Mark as failed — no valid account
    db.prepare("UPDATE queue SET status = 'failed', error = 'Account inactive or missing' WHERE id = ?")
      .run(item.id);
    db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?')
      .run(item.campaign_id);
    logEvent(db, item.campaign_id, item.account_id, item.recipient_email, 'failed', 'Account inactive');
    return;
  }

  // Mark as sending
  db.prepare("UPDATE queue SET status = 'sending' WHERE id = ?").run(item.id);

  try {
    // Get content (with variation support)
    const { subject, body_html } = getContent(item, item);
    const finalSubject = personalise(subject, item.recipient_email);
    const personalisedBody = personalise(body_html, item.recipient_email);
    const finalBody = injectTracking(personalisedBody, item.id);

    await sendEmail(account, item.recipient_email, finalSubject, finalBody);

    // Mark as sent
    db.prepare("UPDATE queue SET status = 'sent', sent_at = datetime('now') WHERE id = ?")
      .run(item.id);
    db.prepare('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?')
      .run(item.campaign_id);
    db.prepare('UPDATE accounts SET daily_sent = daily_sent + 1 WHERE id = ?')
      .run(account.id);

    logEvent(db, item.campaign_id, account.id, item.recipient_email, 'sent', 'OK');
    console.log(`[Scheduler] ✓ Sent to ${item.recipient_email} via ${account.email}`);

    // Check if campaign is complete
    const remaining = db.prepare(
      "SELECT COUNT(*) as c FROM queue WHERE campaign_id = ? AND status = 'pending'"
    ).get(item.campaign_id);

    if (remaining && remaining.c === 0) {
      db.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ?").run(item.campaign_id);
      console.log(`[Scheduler] Campaign ${item.campaign_id} completed!`);
    }
  } catch (err) {
    // Mark as failed
    db.prepare("UPDATE queue SET status = 'failed', error = ? WHERE id = ?")
      .run(err.message, item.id);
    db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?')
      .run(item.campaign_id);
    logEvent(db, item.campaign_id, account.id, item.recipient_email, 'failed', err.message);
    console.error(`[Scheduler] ✗ Failed ${item.recipient_email}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Log helper
// ---------------------------------------------------------------------------

function logEvent(db, campaignId, accountId, recipient, status, message) {
  try {
    db.prepare(`
      INSERT INTO logs (campaign_id, account_id, recipient_email, status, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(campaignId, accountId, recipient, status, message);
  } catch (err) {
    console.error('[Scheduler] Log write error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Cron: every 10 seconds
// ---------------------------------------------------------------------------

cron.schedule('*/10 * * * * *', async () => {
  try {
    await processNextItem();
  } catch (err) {
    console.error('[Scheduler] Unexpected error:', err.message);
  }
});

// Daily reset of account send counters at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const db = await getDb();
    db.prepare("UPDATE accounts SET daily_sent = 0, last_reset = datetime('now')").run();
    console.log('[Scheduler] Daily send counters reset.');
  } catch (err) {
    console.error('[Scheduler] Counter reset error:', err.message);
  }
});

console.log('[Scheduler] Email worker started (every 10s).');

module.exports = { processNextItem };
