/**
 * scheduler.js — Background email worker.
 *
 * Runs every 30 seconds via node-cron.
 * Picks the next pending queue item, checks the sending window,
 * sends the email via Gmail API, and updates the queue/campaign status.
 *
 * Round-robin account rotation is pre-assigned at campaign launch time,
 * so this worker just processes each item with its assigned account.
 */

const cron = require('node-cron');
const { google } = require('googleapis');
const { getDb } = require('./db');
const logger = require('./logger');

// Import helpers from the accounts route
const {
  ensureFreshToken,
  makeRawEmail,
  getOAuth2Client,
  createSmtpTransport,
} = require('./routes/accounts');
const { parseSpintax } = require('./execution/spintax');

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
  const subject = campaign.c_subject || campaign.subject;
  const body_html = campaign.c_body_html || campaign.body_html;
  if (campaign.content_mode !== 'rotation' || !campaign.content_variations) {
    return {
      subject: subject,
      body_html: body_html,
    };
  }

  try {
    const variations = JSON.parse(campaign.content_variations);
    if (!Array.isArray(variations) || variations.length === 0) {
      return { subject: subject, body_html: body_html };
    }
    const index = (queueItem.id - 1) % variations.length;
    const v = variations[index];
    return {
      subject: v.subject || subject,
      body_html: v.body_html || body_html,
    };
  } catch {
    return { subject: subject, body_html: body_html };
  }
}

/**
 * Simple template variable replacement.
 * Supports {{email}} and {{date}}.
 */
function personalise(text, recipient, fieldsStr, accountDisplayName) {
  if (!text) return text;

  // 1. Run Spintax resolution
  let result = parseSpintax(text);

  // 2. Parse fields JSON
  let fields = {};
  if (fieldsStr) {
    try {
      fields = typeof fieldsStr === 'string' ? JSON.parse(fieldsStr) : fieldsStr;
    } catch (_) {
      fields = {};
    }
  }

  // Get local part and domain part of email
  const [localPart, domainPart] = recipient ? recipient.split('@') : ['', ''];
  const pSname = domainPart ? domainPart.split('.')[0] : '';
  const displayName = fields.first_name || fields.name || fields.firstName || localPart || '';
  const storeName = fields.store_name || fields.store || fields.storeName || domainPart || '';
  const brandName = accountDisplayName || fields.brand || '';

  const now = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const resolveVar = (key) => {
    const normKey = key.trim().toLowerCase();

    // Check built-in or fallbacks
    if (normKey === 'email') return recipient || '';
    if (normKey === 'date') return now;
    if (normKey === 'name' || normKey === 'first_name' || normKey === 'firstname') return displayName;
    if (normKey === 'store' || normKey === 'store_name' || normKey === 'storename') return storeName;
    if (normKey === 'sname') return pSname;
    if (normKey === 'brand') return brandName;

    // Direct lookups in custom fields
    if (fields && fields[normKey] !== undefined && fields[normKey] !== null) return String(fields[normKey]);
    if (fields && fields[key] !== undefined && fields[key] !== null) return String(fields[key]);

    // Case-insensitive fallback lookup
    if (fields && typeof fields === 'object') {
      const matchKey = Object.keys(fields).find(k => k.toLowerCase() === normKey);
      if (matchKey && fields[matchKey] !== undefined && fields[matchKey] !== null) {
        return String(fields[matchKey]);
      }
    }

    // Return empty string to cleanly omit missing placeholder
    return '';
  };

  // 3. Dynamic double curly brace {{variable}} replacements
  result = result.replace(/\{\{([^{}]+)\}\}/g, (_, key) => resolveVar(key));

  // 4. Dynamic single curly brace {variable} replacements (excluding spintax containing pipe '|')
  result = result.replace(/\{([a-zA-Z0-9_\-\s]+)\}/g, (_, key) => resolveVar(key));

  return result;
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
  const fromAddr = account.display_name
    ? `"${account.display_name}" <${account.email}>`
    : account.email;

  // RFC 8058 List-Unsubscribe headers (required by Gmail for bulk senders)
  const unsubEmail = `unsubscribe+${to.replace('@', '=')}@${account.email.split('@')[1]}`;
  const unsubHeader = `<mailto:${unsubEmail}?subject=unsubscribe>`;

  if (account.type === 'smtp') {
    // Send via Nodemailer SMTP transport
    const transport = createSmtpTransport(account);
    await transport.sendMail({
      from: fromAddr,
      to,
      subject,
      html: bodyHtml,
      headers: {
        'List-Unsubscribe': unsubHeader,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  } else {
    // Send via Gmail API (OAuth)
    const accessToken = await ensureFreshToken(account);
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const raw = makeRawEmail(account.email, to, subject, bodyHtml, {
      'List-Unsubscribe': unsubHeader,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });

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
    logger.error({ err }, 'DB not ready');
    return;
  }

  const BATCH_SIZE = parseInt(process.env.SCHEDULER_BATCH_SIZE, 10) || 10;
  const nowIso = new Date().toISOString();

  // Find the next pending items whose scheduled time has passed
  const items = await db.prepare(`
    SELECT q.*, c.status as campaign_status,
           c.subject as c_subject, c.body_html as c_body_html,
           c.start_time, c.end_time,
           c.content_variations, c.content_mode
    FROM queue q
    JOIN campaigns c ON q.campaign_id = c.id
    WHERE q.status = 'pending'
      AND c.status = 'sending'
      AND q.scheduled_at <= ?
    ORDER BY q.scheduled_at ASC
    LIMIT ?
  `).all(nowIso, BATCH_SIZE);

  if (!items || items.length === 0) {
    await completeEmptySendingCampaigns(db);
    return;
  }

  const accountSentInBatch = {};

  // Process items grouped by account to avoid race conditions on account counters.
  const concurrency = parseInt(process.env.SENDER_CONCURRENCY || '3', 10) || 3;
  const groups = new Map();
  for (const item of items) {
    const key = String(item.account_id || 'null');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const groupEntries = Array.from(groups.entries());
  let idx = 0;

  async function processGroup(_accountIdKey, groupItems) {
    for (const item of groupItems) {
      // Check sending window
      if (!isWithinSendingWindow(item)) {
        continue; // Outside allowed hours, skip this one
      }

      // Get the assigned sender account
      const account = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(item.account_id);
      if (!account || account.status !== 'active') {
        // Mark as failed — no valid account
        await db.prepare("UPDATE queue SET status = 'failed', error = 'Account inactive or missing' WHERE id = ?").run(item.id);
        await db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?').run(item.campaign_id);
        await logEvent(db, item.campaign_id, item.account_id, item.recipient_email, 'failed', 'Account inactive or missing', item.id);
        continue;
      }

      // Check daily send limit (default limit is 450)
      const dailyLimit = account.daily_limit !== null && account.daily_limit !== undefined ? account.daily_limit : 450;
      const currentSent = account.daily_sent + (accountSentInBatch[account.id] || 0);
      if (currentSent >= dailyLimit) {
        logger.info({ email: account.email, dailyLimit, itemId: item.id }, 'Account daily limit hit. Rescheduling queue item to tomorrow');
        // Reschedule to tomorrow (add 1 day)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await db.prepare("UPDATE queue SET scheduled_at = ? WHERE id = ?").run(tomorrow.toISOString(), item.id);
        continue;
      }

      // Check if recipient has replied or unsubscribed in this campaign
      const recipientTracker = await db.prepare('SELECT status FROM campaign_recipients WHERE campaign_id = ? AND recipient_email = ?').get(item.campaign_id, item.recipient_email);
      if (recipientTracker && (recipientTracker.status === 'replied' || recipientTracker.status === 'unsubscribed')) {
        // Delete from queue directly and skip
        await db.prepare("DELETE FROM queue WHERE id = ?").run(item.id);
        logger.info({ recipient: item.recipient_email, campaignId: item.campaign_id }, 'Skipping email send: recipient replied or unsubscribed');
        await completeCampaignIfNoActiveQueue(db, item.campaign_id);
        continue;
      }

      // Reserve a send slot atomically and mark as sending in the same DB transaction.
      // This prevents race conditions under high concurrency.
      let reserved = false;
      try {
        reserved = await db.transaction(async (tx) => {
          const accRow = await tx.prepare('SELECT daily_sent, daily_limit FROM accounts WHERE id = ?').get(account.id);
          if (!accRow) return false;
          const limit = accRow.daily_limit !== null && accRow.daily_limit !== undefined ? accRow.daily_limit : 450;
          if ((accRow.daily_sent || 0) >= limit) {
            return false;
          }
          // Increment the counter and mark queue item as sending atomically
          await tx.prepare('UPDATE accounts SET daily_sent = daily_sent + 1 WHERE id = ?').run(account.id);
          await tx.prepare("UPDATE queue SET status = 'sending' WHERE id = ?").run(item.id);
          return true;
        })();
      } catch (txErr) {
        logger.error({ err: txErr, account: account.id, item: item.id }, 'Error reserving send slot');
        reserved = false;
      }

      if (!reserved) {
        // Could not reserve a slot — reschedule or mark appropriately
        logger.info({ accountId: account.id, itemId: item.id }, 'Account daily limit reached or reservation failed; rescheduling item');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await db.prepare("UPDATE queue SET scheduled_at = ? WHERE id = ?").run(tomorrow.toISOString(), item.id);
        continue;
      }
      // Track in-memory as well for the current batch
      accountSentInBatch[account.id] = (accountSentInBatch[account.id] || 0) + 1;

      try {
        // Get content: load from step table if campaign_step_id is present, otherwise fallback to main campaign fields
        let subject, body_html;
        if (item.campaign_step_id) {
          const step = await db.prepare('SELECT subject, body_html FROM campaign_steps WHERE id = ?').get(item.campaign_step_id);
          if (step) {
            subject = step.subject;
            body_html = step.body_html;
          }
        }

        if (!subject || !body_html) {
          const contentRes = getContent(item, item);
          subject = contentRes.subject;
          body_html = contentRes.body_html;
        }

        const finalSubject = personalise(subject, item.recipient_email, item.fields, account.display_name);
        const personalisedBody = personalise(body_html, item.recipient_email, item.fields, account.display_name);
        const finalBody = injectTracking(personalisedBody, item.id);

        await sendEmail(account, item.recipient_email, finalSubject, finalBody);

        // Mark as sent
        await db.prepare("UPDATE queue SET status = 'sent', sent_at = ?, final_subject = ?, final_body = ? WHERE id = ?")
          .run(new Date().toISOString(), finalSubject, finalBody, item.id);
        await db.prepare('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?').run(item.campaign_id);

        await logEvent(db, item.campaign_id, account.id, item.recipient_email, 'sent', 'OK', item.id);
        logger.info({ recipient: item.recipient_email, sender: account.email }, 'Email sent successfully');

        // Update recipient step status & queue follow-ups
        const currentStepNum = item.step_number || 1;
        await db.prepare(`
          UPDATE campaign_recipients
          SET current_step = ?, last_sent_at = ?
          WHERE campaign_id = ? AND recipient_email = ?
        `).run(currentStepNum, new Date().toISOString(), item.campaign_id, item.recipient_email);

        // Check if there is a next step in the campaign
        const nextStep = await db.prepare('SELECT * FROM campaign_steps WHERE campaign_id = ? AND step_number = ?').get(item.campaign_id, currentStepNum + 1);

        if (nextStep) {
          // Schedule next step if recipient status is active
          const rec = await db.prepare('SELECT status FROM campaign_recipients WHERE campaign_id = ? AND recipient_email = ?').get(item.campaign_id, item.recipient_email);
          if (rec && rec.status === 'active') {
            const delayMs = (nextStep.delay_seconds || 86400) * 1000;
            const scheduledTime = new Date(Date.now() + delayMs);

            await db.prepare(`
              INSERT INTO queue (campaign_id, recipient_email, account_id, status, scheduled_at, fields, step_number, campaign_step_id)
              VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
            `).run(item.campaign_id, item.recipient_email, account.id, scheduledTime.toISOString(), item.fields, nextStep.step_number, nextStep.id);

            logger.info({ recipient: item.recipient_email, campaignId: item.campaign_id, nextStep: nextStep.step_number, scheduledAt: scheduledTime }, 'Scheduled follow-up email step');
          }
        } else {
          // Mark recipient campaign run as completed
          await db.prepare(`
            UPDATE campaign_recipients
            SET status = 'completed'
            WHERE campaign_id = ? AND recipient_email = ? AND status = 'active'
          `).run(item.campaign_id, item.recipient_email);
        }

        await completeCampaignIfNoActiveQueue(db, item.campaign_id);
      } catch (err) {
        // Decrement the batch count for this account since it failed to send
        if (accountSentInBatch[account.id] > 0) {
          accountSentInBatch[account.id]--;
        }

        // If we reserved a DB slot earlier, release it so other items can use it
        if (reserved) {
          try {
            await db.prepare('UPDATE accounts SET daily_sent = daily_sent - 1 WHERE id = ? AND daily_sent > 0').run(account.id);
          } catch (decErr) {
            logger.error({ err: decErr, account: account.id }, 'Failed to decrement daily_sent after send failure');
          }
        }

        // Check retry_count for exponential backoff
        const currentRetryCount = item.retry_count || 0;
        if (currentRetryCount < 3) {
          const nextRetryCount = currentRetryCount + 1;
          // Exponential backoff minutes: 1st retry: 5 mins, 2nd: 15 mins, 3rd: 45 mins
          const backoffMinutes = Math.pow(3, nextRetryCount - 1) * 5;
          const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await db.prepare("UPDATE queue SET status = 'pending', retry_count = ?, scheduled_at = ?, error = ? WHERE id = ?")
            .run(nextRetryCount, nextAttempt.toISOString(), err.message, item.id);

          await logEvent(db, item.campaign_id, account.id, item.recipient_email, 'retry', `Attempt ${nextRetryCount} failed: ${err.message}. Retrying at ${nextAttempt.toISOString()}`, item.id);
          logger.warn({ err, recipient: item.recipient_email, attempt: nextRetryCount, backoffMinutes }, 'Temporary sending failure');
        } else {
          // Mark as failed permanently
            await db.prepare("UPDATE queue SET status = 'failed', error = ? WHERE id = ?").run(err.message, item.id);
          await db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?').run(item.campaign_id);
          await logEvent(db, item.campaign_id, account.id, item.recipient_email, 'failed', err.message, item.id);
            logger.error({ err, recipient: item.recipient_email }, 'Permanent sending failure');

          // Reservation was consumed for this permanent failure — decrement to free quota
          if (reserved) {
            try {
              await db.prepare('UPDATE accounts SET daily_sent = daily_sent - 1 WHERE id = ? AND daily_sent > 0').run(account.id);
            } catch (decErr) {
              logger.error({ err: decErr, account: account.id }, 'Failed to decrement daily_sent after permanent failure');
            }
          }

          await completeCampaignIfNoActiveQueue(db, item.campaign_id);
        }
      }
    }
  }

  // Run groups with limited concurrency
  const workers = new Array(concurrency).fill(null).map(async () => {
    while (true) {
      const i = idx++;
      if (i >= groupEntries.length) break;
      const [accountKey, groupItems] = groupEntries[i];
      try {
        await processGroup(accountKey, groupItems);
      } catch (err) {
        logger.error({ err, accountKey }, 'Error processing account group');
      }
    }
  });

  await Promise.all(workers);
}

async function completeCampaignIfNoActiveQueue(db, campaignId) {
  try {
    const row = await db.prepare(`
      SELECT COUNT(*) as activeCount
      FROM queue
      WHERE campaign_id = ? AND status IN ('pending', 'sending')
    `).get(campaignId);

    if (!row || row.activeCount === 0) {
      await db.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ? AND status = 'sending'").run(campaignId);
      logger.info({ campaignId }, 'Campaign marked completed (no active queue items remain)');
    }
  } catch (err) {
    logger.error({ err, campaignId }, 'Error finalizing campaign completion');
  }
}

async function completeEmptySendingCampaigns(db) {
  try {
    const rows = await db.prepare(`
      SELECT c.id
      FROM campaigns c
      LEFT JOIN (
        SELECT campaign_id, COUNT(*) as activeCount
        FROM queue
        WHERE status IN ('pending', 'sending')
        GROUP BY campaign_id
      ) q ON q.campaign_id = c.id
      WHERE c.status = 'sending' AND COALESCE(q.activeCount, 0) = 0
    `).all();

    for (const row of rows) {
      await db.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ?").run(row.id);
      logger.info({ campaignId: row.id }, 'Campaign marked completed during scheduler sweep (no active queue items)');
    }
  } catch (err) {
    logger.error({ err }, 'Error completing empty sending campaigns');
  }
}

// ---------------------------------------------------------------------------
// Log helper
// ---------------------------------------------------------------------------

async function logEvent(db, campaignId, accountId, recipient, status, message, queueId = null) {
  try {
    await db.prepare(`
      INSERT INTO logs (campaign_id, account_id, recipient_email, status, message, queue_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(campaignId, accountId, recipient, status, message, queueId);
  } catch (err) {
    // Fallback if queue_id column doesn't exist yet in the database
    try {
      await db.prepare(`
        INSERT INTO logs (campaign_id, account_id, recipient_email, status, message)
        VALUES (?, ?, ?, ?, ?)
      `).run(campaignId, accountId, recipient, status, message);
    } catch (fallbackErr) {
      logger.error({ err: fallbackErr }, 'Log write error');
    }
  }
}

// ---------------------------------------------------------------------------
// Startup: crash recovery + validation
// ---------------------------------------------------------------------------

(async () => {
  try {
    const db = await getDb();

    // Recover any queue items stuck in 'sending' from a previous crash
    const stuck = await db.prepare(
      "UPDATE queue SET status = 'pending' WHERE status = 'sending'"
    ).run();
    if (stuck.changes > 0) {
      logger.info({ count: stuck.changes }, 'Recovered stuck queue items from previous crash');
    }
  } catch (err) {
    logger.error({ err }, 'Startup recovery failed');
  }

  // Warn if TRACKING_BASE_URL is still localhost in non-dev environments
  const trackingUrl = process.env.TRACKING_BASE_URL || 'http://localhost:3000';
  if (trackingUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
    logger.warn('TRACKING_BASE_URL is set to localhost — tracking pixels will not work in production!');
  }
})();

// ---------------------------------------------------------------------------
// Cron: every 30 seconds
// ---------------------------------------------------------------------------

const schedulerEnabled = process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true';
let sendTask;
let resetTask;

if (schedulerEnabled) {
  sendTask = cron.schedule('*/30 * * * * *', async () => {
    try {
      await processNextItem();
    } catch (err) {
      logger.error({ err }, 'Unexpected error in cron send task');
    }
  });

  // Daily reset of account send counters at midnight
  resetTask = cron.schedule('0 0 * * *', async () => {
    try {
      const db = await getDb();
      await db.prepare("UPDATE accounts SET daily_sent = 0, last_reset = datetime('now')").run();
      logger.info('Daily send counters reset');
    } catch (err) {
      logger.error({ err }, 'Counter reset error');
    }
  });

  logger.info('Email worker started (every 30s)');
} else {
  sendTask = { stop: () => {} };
  resetTask = { stop: () => {} };
  logger.info('Email worker is disabled in local development. Set NODE_ENV=production or ENABLE_SCHEDULER=true to enable it.');
}

function stopScheduler() {
  sendTask.stop();
  resetTask.stop();
  logger.info('Email worker stopped');
}

module.exports = { processNextItem, personalise, completeCampaignIfNoActiveQueue, stopScheduler };

