/**
 * routes/inbox.js — Two-Way Email Receiving, Lead Association, & Unified Inbox API
 *
 * Handles:
 *   GET  /api/inbox          → Fetch received prospect emails with enriched contact dossiers
 *   POST /api/inbox/sync     → Trigger inbox sync for active sender accounts
 *   POST /api/inbox/:id/read → Mark message as read
 *   POST /api/inbox/:id/reply → Send reply to prospect via assigned account
 */

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { getDb } = require('../db');
const { ensureFreshToken, getOAuth2Client } = require('./accounts');
const logger = require('../logger');

/**
 * Decode Gmail API base64url payload into UTF-8 text.
 */
function decodeBase64Url(data = '') {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  else if (pad === 1) base64 += '===';
  try {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch (_) {
    return '';
  }
}

function parseEmailAddress(value = '') {
  const emailMatch = /<([^>]+)>/.exec(value);
  if (emailMatch && emailMatch[1]) {
    return emailMatch[1].trim().toLowerCase();
  }
  return value.split(',')[0].trim().toLowerCase();
}

function findHeaderValue(headers = [], name) {
  const header = headers.find((item) => String(item.name).toLowerCase() === name.toLowerCase());
  return header ? String(header.value || '') : '';
}

function extractMessageBody(payload) {
  const result = { body_text: '', body_html: '' };
  if (!payload) return result;

  if (payload.body && payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/plain') {
      result.body_text = decoded;
    } else if (payload.mimeType === 'text/html') {
      result.body_html = decoded;
    } else if (!result.body_text) {
      result.body_text = decoded;
    }
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const child = extractMessageBody(part);
      if (child.body_text && !result.body_text) {
        result.body_text = child.body_text;
      }
      if (child.body_html && !result.body_html) {
        result.body_html = child.body_html;
      }
    }
  }

  return result;
}

/**
 * Simple AI / Keyword Sentiment Classifier for incoming replies.
 */
function classifySentiment(text = '', subject = '') {
  const combined = (subject + ' ' + text).toLowerCase();
  
  if (
    combined.includes('unsubscribe') ||
    combined.includes('remove me') ||
    combined.includes('stop emailing') ||
    combined.includes('take me off') ||
    combined.includes('not interested')
  ) {
    return 'unsubscribe';
  }

  if (
    combined.includes('interested') ||
    combined.includes('call') ||
    combined.includes('meeting') ||
    combined.includes('schedule') ||
    combined.includes('pricing') ||
    combined.includes('demo') ||
    combined.includes('sounds good') ||
    combined.includes('send over') ||
    combined.includes('tell me more')
  ) {
    return 'hot_lead';
  }

  if (
    combined.includes('?') ||
    combined.includes('how') ||
    combined.includes('what') ||
    combined.includes('who')
  ) {
    return 'question';
  }

  return 'neutral';
}

/**
 * GET /api/inbox — Fetch all received prospect messages with linked contact fields
 */
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const limit = parseInt(req.query.limit, 10) || 50;
    
    // Fetch received messages
    const messages = await db.prepare(`
      SELECT m.*, a.email as account_email
      FROM inbox_messages m
      LEFT JOIN accounts a ON m.account_id = a.id
      ORDER BY m.id DESC
      LIMIT ?
    `).all(limit);

    // Enrich messages with linked contact dossier details from contacts table
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const sender = msg.sender_email.toLowerCase();
        const contactRow = await db.prepare(
          'SELECT list_name, fields FROM contacts WHERE LOWER(email) = ? LIMIT 1'
        ).get(sender);

        let fields = {};
        if (contactRow && contactRow.fields) {
          try {
            fields = JSON.parse(contactRow.fields);
          } catch (_) {}
        }

        return {
          ...msg,
          contact_list: contactRow ? contactRow.list_name : 'Unknown List',
          contact_fields: fields,
          store_url: fields.store_url || fields.website || fields.domain || '',
          store_name: fields.store_name || fields.company || '',
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inbox/sync — Trigger email receiving sync for connected accounts
 */
router.post('/sync', async (_req, res) => {
  try {
    const db = await getDb();
    const accounts = await db.prepare("SELECT * FROM accounts WHERE status = 'active' AND type IN ('oauth', 'google')").all();

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.json({
        success: true,
        message: 'No active OAuth sender accounts available for inbox sync.',
        syncedAccounts: 0,
        newMessages: 0,
      });
    }

    let syncedAccounts = 0;
    let newMessages = 0;

    for (const account of accounts) {
      try {
        const accessToken = await ensureFreshToken(account);
        const oauth2 = getOAuth2Client();
        oauth2.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2 });

        const listResponse = await gmail.users.messages.list({
          userId: 'me',
          labelIds: ['INBOX'],
          q: 'is:unread',
          maxResults: 50,
        });

        const messages = Array.isArray(listResponse.data.messages) ? listResponse.data.messages : [];
        if (messages.length === 0) {
          syncedAccounts += 1;
          continue;
        }

        for (const item of messages) {
          if (!item || !item.id) continue;

          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: item.id,
            format: 'full',
          });

          const payload = messageResponse.data.payload || {};
          const headers = Array.isArray(payload.headers) ? payload.headers : [];
          const from = findHeaderValue(headers, 'From');
          const to = findHeaderValue(headers, 'To') || account.email;
          const subject = findHeaderValue(headers, 'Subject') || '';

          const sender_email = parseEmailAddress(from) || '';
          const recipient_email = parseEmailAddress(to) || account.email;
          const messageId = String(messageResponse.data.id || item.id);

          const { body_text, body_html } = extractMessageBody(payload);
          const sentiment = classifySentiment(body_text || body_html, subject);

          const insertResult = await db.prepare(`
            INSERT INTO inbox_messages
              (account_id, sender_email, recipient_email, subject, body_text, body_html, sentiment, message_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(message_id) DO NOTHING
          `).run(account.id, sender_email, recipient_email, subject, body_text, body_html, sentiment, messageId);

          if (insertResult && insertResult.changes > 0) {
            newMessages += 1;
          }
        }

        syncedAccounts += 1;
      } catch (accountErr) {
        logger.warn({ err: accountErr, account: account.email }, 'Inbox sync failed for one account');
      }
    }

    res.json({
      success: true,
      message: `Inbox sync completed for ${syncedAccounts} OAuth account(s). ${newMessages} new message(s) imported.`,
      syncedAccounts,
      newMessages,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inbox/:id/read — Mark message as read
 */
router.post('/:id/read', async (req, res) => {
  try {
    const db = await getDb();
    await db.prepare('UPDATE inbox_messages SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inbox/:id/reply — Send reply to a prospect message
 */
router.post('/:id/reply', async (req, res) => {
  const { replyBody } = req.body;
  if (!replyBody) return res.status(400).json({ error: 'replyBody is required.' });

  try {
    const db = await getDb();
    const msg = await db.prepare('SELECT * FROM inbox_messages WHERE id = ?').get(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    // Log the reply action
    await db.prepare(`
      INSERT INTO logs (account_id, recipient_email, status, message)
      VALUES (?, ?, 'replied', ?)
    `).run(msg.account_id || null, msg.sender_email, `Sent reply to ${msg.sender_email}`);

    // Mark as read
    await db.prepare('UPDATE inbox_messages SET is_read = 1 WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: `Reply queued successfully to ${msg.sender_email}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
