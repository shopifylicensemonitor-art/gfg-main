/**
 * scheduler.js — Production Queue Processor & Email Engine.
 *
 * Implements:
 *   1. Atomic PostgreSQL queue claiming via FOR UPDATE SKIP LOCKED
 *   2. Stale job recovery for timed-out worker leases
 *   3. Controlled retries with exponential backoff
 *   4. Campaign sending window & account daily limit enforcement
 *   5. Personalisation, Spintax, and Tracking Pixel injection
 *   6. Multi-step campaign progression
 */

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
  if (campaign.ignore_window || (campaign.start_time === '00:00' && (campaign.end_time === '23:59' || campaign.end_time === '24:00'))) {
    return true;
  }
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes;

  const [startH = 8, startM = 0] = (campaign.start_time || '08:00').split(':').map(Number);
  const [endH = 22, endM = 0] = (campaign.end_time || '22:00').split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes === endMinutes) return true;

  if (startMinutes <= endMinutes) {
    return currentTime >= startMinutes && currentTime <= endMinutes;
  } else {
    // Overnight window (e.g. 22:00 to 06:00)
    return currentTime >= startMinutes || currentTime <= endMinutes;
  }
}

// ---------------------------------------------------------------------------
// Content variation & Spintax personalisation
// ---------------------------------------------------------------------------

function getContent(campaign, queueItem) {
  const subject = campaign.c_subject || campaign.subject;
  const body_html = campaign.c_body_html || campaign.body_html;
  if (campaign.content_mode !== 'rotation' || !campaign.content_variations) {
    return { subject, body_html };
  }

  try {
    const variations = JSON.parse(campaign.content_variations);
    if (!Array.isArray(variations) || variations.length === 0) {
      return { subject, body_html };
    }
    const index = (queueItem.id - 1) % variations.length;
    const v = variations[index];
    return {
      subject: v.subject || subject,
      body_html: v.body_html || body_html,
    };
  } catch {
    return { subject, body_html };
  }
}

function personalise(text, recipient, fieldsStr, accountDisplayName) {
  if (!text) return text;

  let result = parseSpintax(text);

  let fields = {};
  if (fieldsStr) {
    try {
      fields = typeof fieldsStr === 'string' ? JSON.parse(fieldsStr) : fieldsStr;
    } catch (_) {
      fields = {};
    }
  }

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

    if (normKey === 'email') return recipient || '';
    if (normKey === 'date') return now;
    if (normKey === 'name' || normKey === 'first_name' || normKey === 'firstname') return displayName;
    if (normKey === 'store' || normKey === 'store_name' || normKey === 'storename') return storeName;
    if (normKey === 'sname') return pSname;
    if (normKey === 'brand') return brandName;

    if (fields && fields[normKey] !== undefined && fields[normKey] !== null) return String(fields[normKey]);
    if (fields && fields[key] !== undefined && fields[key] !== null) return String(fields[key]);

    if (fields && typeof fields === 'object') {
      const matchKey = Object.keys(fields).find(k => k.toLowerCase() === normKey);
      if (matchKey && fields[matchKey] !== undefined && fields[matchKey] !== null) {
        return String(fields[matchKey]);
      }
    }

    return '';
  };

  result = result.replace(/\{\{([^{}]+)\}\}/g, (_, key) => resolveVar(key));
  result = result.replace(/\{([a-zA-Z0-9_\-\s]+)\}/g, (_, key) => resolveVar(key));

  return result;
}

function injectTracking(bodyHtml, queueItemId) {
  if (!bodyHtml) return bodyHtml;
  const baseUrl = process.env.TRACKING_BASE_URL || 'http://localhost:3000';

  let trackedBody = bodyHtml.replace(/href=(["'])([^"'\s>]+)\1/gi, (match, quote, url) => {
    if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.includes('/api/track/')) {
      return match;
    }
    const wrappedUrl = `${baseUrl}/api/track/click/${queueItemId}?url=${encodeURIComponent(url)}`;
    return `href=${quote}${wrappedUrl}${quote}`;
  });

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
// Send single email via provider
// ---------------------------------------------------------------------------

async function sendEmail(account, to, subject, bodyHtml) {
  const fromAddr = account.display_name
    ? `"${account.display_name}" <${account.email}>`
    : account.email;

  const unsubEmail = `unsubscribe+${to.replace('@', '=')}@${account.email.split('@')[1]}`;
  const unsubHeader = `<mailto:${unsubEmail}?subject=unsubscribe>`;

  if (account.type === 'smtp') {
    const transport = createSmtpTransport(account);
    const info = await transport.sendMail({
      from: fromAddr,
      to,
      subject,
      html: bodyHtml,
      headers: {
        'List-Unsubscribe': unsubHeader,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    return info.messageId || null;
  } else {
    const accessToken = await ensureFreshToken(account);
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const raw = makeRawEmail(account.email, to, subject, bodyHtml, {
      'List-Unsubscribe': unsubHeader,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
    return res.data.id || null;
  }
}

// ---------------------------------------------------------------------------
// Stale Job Recovery
// ---------------------------------------------------------------------------

/**
 * Reclaim queue jobs that were locked by a worker process that crashed or timed out (> 5 min ago).
 */
async function recoverStaleJobs() {
  try {
    const db = await getDb();
    if (db._isPg) {
      const res = await db.prepare(`
        UPDATE queue
        SET status = 'pending', locked_at = NULL, locked_by = NULL
        WHERE status = 'processing'
          AND locked_at < NOW() - INTERVAL '5 minutes'
      `).run();
      return res.changes || 0;
    } else {
      const res = await db.prepare(`
        UPDATE queue
        SET status = 'pending', locked_at = NULL, locked_by = NULL
        WHERE status = 'processing'
      `).run();
      return res.changes || 0;
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to recover stale jobs');
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Production Queue Batch Processor (Atomic row locking)
// ---------------------------------------------------------------------------

/**
 * Claim and process a batch of due queue items for a given worker.
 */
async function processQueueBatch(workerId = 'worker-1') {
  let db;
  try {
    db = await getDb();
  } catch (err) {
    logger.error({ err: err.message }, 'DB connection unavailable in worker');
    return 0;
  }

  const BATCH_SIZE = parseInt(process.env.SCHEDULER_BATCH_SIZE, 10) || 10;
  let items = [];

  if (db._isPg) {
    // Production PostgreSQL: Atomic row-level claim with FOR UPDATE SKIP LOCKED
    try {
      const claimedItems = await db.transaction(async (tx) => {
        const rows = await tx.prepare(`
          SELECT q.id, q.workspace_id, q.campaign_id, q.recipient_email, q.account_id,
                 q.step_number, q.campaign_step_id, q.attempts, q.retry_count, q.fields,
                 c.status as campaign_status, c.subject as c_subject, c.body_html as c_body_html,
                 c.start_time, c.end_time, c.content_variations, c.content_mode
          FROM queue q
          JOIN campaigns c ON q.campaign_id = c.id
          WHERE q.status IN ('pending', 'retrying')
            AND c.status = 'sending'
            AND (q.scheduled_at IS NULL OR q.scheduled_at <= NOW())
            AND (q.next_attempt_at IS NULL OR q.next_attempt_at <= NOW())
          ORDER BY q.scheduled_at ASC NULLS FIRST, q.id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        `).all(BATCH_SIZE);

        if (!rows || rows.length === 0) return [];

        const ids = rows.map(r => r.id);
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
        await tx.prepare(`
          UPDATE queue
          SET status = 'processing',
              locked_at = NOW(),
              locked_by = $1
          WHERE id IN (${placeholders})
        `).run(workerId, ...ids);

        return rows;
      })();
      items = claimedItems || [];
    } catch (err) {
      logger.error({ err: err.message }, 'PostgreSQL SKIP LOCKED claim error');
      return 0;
    }
  } else {
    // Fallback SQLite mode: claim items in a transaction
    try {
      const nowIso = new Date().toISOString();
      const claimedItems = await db.transaction(async (tx) => {
        const rows = await tx.prepare(`
          SELECT q.id, q.workspace_id, q.campaign_id, q.recipient_email, q.account_id,
                 q.step_number, q.campaign_step_id, q.attempts, q.retry_count, q.fields,
                 c.status as campaign_status, c.subject as c_subject, c.body_html as c_body_html,
                 c.start_time, c.end_time, c.content_variations, c.content_mode
          FROM queue q
          JOIN campaigns c ON q.campaign_id = c.id
          WHERE q.status IN ('pending', 'retrying')
            AND c.status = 'sending'
            AND (q.scheduled_at IS NULL OR q.scheduled_at <= ?)
          ORDER BY q.id ASC
          LIMIT ?
        `).all(nowIso, BATCH_SIZE);

        if (!rows || rows.length === 0) return [];

        for (const r of rows) {
          await tx.prepare("UPDATE queue SET status = 'processing', locked_by = ? WHERE id = ?").run(workerId, r.id);
        }
        return rows;
      })();
      items = claimedItems || [];
    } catch (err) {
      logger.error({ err: err.message }, 'SQLite queue claim error');
      return 0;
    }
  }

  if (items.length === 0) {
    await completeEmptySendingCampaigns(db);
    return 0;
  }

  let processedCount = 0;

  for (const item of items) {
    // Check sending window
    if (!isWithinSendingWindow(item)) {
      // Outside hours — unlock item back to pending
      await db.prepare("UPDATE queue SET status = 'pending', locked_at = NULL, locked_by = NULL WHERE id = ?").run(item.id);
      continue;
    }

    // Check sender account
    const account = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(item.account_id);
    if (!account || account.status !== 'active') {
      await db.prepare(`
        UPDATE queue
        SET status = 'failed', error = 'Account inactive or missing', locked_at = NULL, locked_by = NULL
        WHERE id = ?
      `).run(item.id);
      await db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?').run(item.campaign_id);
      await logEvent(db, item.workspace_id, item.campaign_id, item.account_id, item.recipient_email, 'failed', 'Account inactive or missing', item.id);
      continue;
    }

    // Check daily send limit
    const dailyLimit = account.daily_limit !== null && account.daily_limit !== undefined ? account.daily_limit : 450;
    if ((account.daily_sent || 0) >= dailyLimit) {
      logger.info({ email: account.email, dailyLimit, itemId: item.id }, 'Account daily limit reached. Rescheduling to tomorrow');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await db.prepare(`
        UPDATE queue
        SET status = 'pending', scheduled_at = ?, locked_at = NULL, locked_by = NULL
        WHERE id = ?
      `).run(tomorrow.toISOString(), item.id);
      continue;
    }

    // Check if recipient unsubscribed or replied
    const recipientTracker = await db.prepare(
      'SELECT status FROM campaign_recipients WHERE campaign_id = ? AND recipient_email = ?'
    ).get(item.campaign_id, item.recipient_email);

    if (recipientTracker && (recipientTracker.status === 'replied' || recipientTracker.status === 'unsubscribed')) {
      await db.prepare("DELETE FROM queue WHERE id = ?").run(item.id);
      logger.info({ recipient: item.recipient_email, campaignId: item.campaign_id }, 'Skipping email send: recipient replied or unsubscribed');
      await completeCampaignIfNoActiveQueue(db, item.campaign_id);
      continue;
    }

    // Send email
    try {
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

      const messageId = await sendEmail(account, item.recipient_email, finalSubject, finalBody);

      // Update queue item as sent
      await db.prepare(`
        UPDATE queue
        SET status = 'sent',
            sent_at = NOW(),
            final_subject = ?,
            final_body = ?,
            provider_message_id = ?,
            locked_at = NULL,
            locked_by = NULL
        WHERE id = ?
      `).run(finalSubject, finalBody, messageId || null, item.id);

      // Update stats
      await db.prepare('UPDATE accounts SET daily_sent = daily_sent + 1 WHERE id = ?').run(account.id);
      await db.prepare('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?').run(item.campaign_id);

      await logEvent(db, item.workspace_id, item.campaign_id, account.id, item.recipient_email, 'sent', 'OK', item.id);
      logger.info({ recipient: item.recipient_email, sender: account.email, workerId }, 'Email sent successfully');

      // Update recipient step status & queue next step
      const currentStepNum = item.step_number || 1;
      await db.prepare(`
        UPDATE campaign_recipients
        SET current_step = ?, last_sent_at = NOW()
        WHERE campaign_id = ? AND recipient_email = ?
      `).run(currentStepNum, item.campaign_id, item.recipient_email);

      const nextStep = await db.prepare(
        'SELECT * FROM campaign_steps WHERE campaign_id = ? AND step_number = ?'
      ).get(item.campaign_id, currentStepNum + 1);

      if (nextStep) {
        const rec = await db.prepare(
          'SELECT status FROM campaign_recipients WHERE campaign_id = ? AND recipient_email = ?'
        ).get(item.campaign_id, item.recipient_email);

        if (rec && rec.status === 'active') {
          const delayMs = (nextStep.delay_seconds || 86400) * 1000;
          const scheduledTime = new Date(Date.now() + delayMs);

          await db.prepare(`
            INSERT INTO queue (workspace_id, campaign_id, recipient_email, account_id, status, scheduled_at, fields, step_number, campaign_step_id)
            VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
          `).run(item.workspace_id, item.campaign_id, item.recipient_email, account.id, scheduledTime.toISOString(), item.fields, nextStep.step_number, nextStep.id);

          logger.info({ recipient: item.recipient_email, campaignId: item.campaign_id, nextStep: nextStep.step_number }, 'Scheduled follow-up email step');
        }
      } else {
        await db.prepare(`
          UPDATE campaign_recipients
          SET status = 'completed'
          WHERE campaign_id = ? AND recipient_email = ? AND status = 'active'
        `).run(item.campaign_id, item.recipient_email);
      }

      await completeCampaignIfNoActiveQueue(db, item.campaign_id);
      processedCount++;
    } catch (err) {
      const attempts = (item.attempts || item.retry_count || 0) + 1;
      if (attempts < 3) {
        // Exponential backoff minutes: 1st: 5m, 2nd: 15m
        const backoffMinutes = Math.pow(3, attempts - 1) * 5;
        const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000);

        await db.prepare(`
          UPDATE queue
          SET status = 'pending',
              attempts = ?,
              retry_count = ?,
              next_attempt_at = ?,
              last_error = ?,
              error = ?,
              locked_at = NULL,
              locked_by = NULL
          WHERE id = ?
        `).run(attempts, attempts, nextAttempt.toISOString(), err.message, err.message, item.id);

        await logEvent(db, item.workspace_id, item.campaign_id, account.id, item.recipient_email, 'retry', `Attempt ${attempts} failed: ${err.message}. Retrying in ${backoffMinutes}m`, item.id);
        logger.warn({ err: err.message, recipient: item.recipient_email, attempt: attempts, backoffMinutes }, 'Transient sending error; scheduled retry');
      } else {
        // Permanent failure
        await db.prepare(`
          UPDATE queue
          SET status = 'failed',
              attempts = ?,
              retry_count = ?,
              last_error = ?,
              error = ?,
              locked_at = NULL,
              locked_by = NULL
          WHERE id = ?
        `).run(attempts, attempts, err.message, err.message, item.id);

        await db.prepare('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = ?').run(item.campaign_id);
        await logEvent(db, item.workspace_id, item.campaign_id, account.id, item.recipient_email, 'failed', err.message, item.id);
        logger.error({ err: err.message, recipient: item.recipient_email }, 'Permanent sending failure; max retries exceeded');
        await completeCampaignIfNoActiveQueue(db, item.campaign_id);
      }
    }
  }

  return processedCount;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function processNextItem() {
  return processQueueBatch('legacy-scheduler');
}

async function completeCampaignIfNoActiveQueue(db, campaignId) {
  try {
    const row = await db.prepare(`
      SELECT COUNT(*) as activeCount
      FROM queue
      WHERE campaign_id = ? AND status IN ('pending', 'processing', 'sending')
    `).get(campaignId);

    if (!row || row.activeCount === 0) {
      await db.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ? AND status = 'sending'").run(campaignId);
      logger.info({ campaignId }, 'Campaign marked completed');
    }
  } catch (err) {
    logger.error({ err: err.message, campaignId }, 'Error finalizing campaign completion');
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
        WHERE status IN ('pending', 'processing', 'sending')
        GROUP BY campaign_id
      ) q ON q.campaign_id = c.id
      WHERE c.status = 'sending' AND COALESCE(q.activeCount, 0) = 0
    `).all();

    for (const row of rows) {
      await db.prepare("UPDATE campaigns SET status = 'completed' WHERE id = ?").run(row.id);
      logger.info({ campaignId: row.id }, 'Campaign marked completed during sweep');
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error completing empty sending campaigns');
  }
}

async function logEvent(db, workspaceId, campaignId, accountId, recipient, status, message, queueId = null) {
  try {
    await db.prepare(`
      INSERT INTO logs (workspace_id, campaign_id, account_id, recipient_email, status, message, queue_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(workspaceId || null, campaignId || null, accountId || null, recipient, status, message, queueId);
  } catch (err) {
    logger.error({ err: err.message }, 'Log write error');
  }
}

module.exports = {
  processQueueBatch,
  recoverStaleJobs,
  processNextItem,
  personalise,
  completeCampaignIfNoActiveQueue,
};
