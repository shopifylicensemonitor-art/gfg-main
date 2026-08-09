/**
 * providers/GmailProvider.js — Google OAuth & Gmail API Provider Implementation.
 */

const { google } = require('googleapis');
const EmailProvider = require('./EmailProvider');
const { decryptSecret, encryptSecret } = require('../lib/crypto');
const { getDb } = require('../db');
const logger = require('../logger');

function getOAuth2Client(customRedirectUri) {
  const redirectUri = customRedirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/accounts/callback';
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

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
  const result = { bodyText: '', bodyHtml: '' };
  if (!payload) return result;

  if (payload.body && payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/plain') {
      result.bodyText = decoded;
    } else if (payload.mimeType === 'text/html') {
      result.bodyHtml = decoded;
    } else if (!result.bodyText) {
      result.bodyText = decoded;
    }
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const child = extractMessageBody(part);
      if (child.bodyText && !result.bodyText) {
        result.bodyText = child.bodyText;
      }
      if (child.bodyHtml && !result.bodyHtml) {
        result.bodyHtml = child.bodyHtml;
      }
    }
  }

  return result;
}

class GmailProvider extends EmailProvider {
  async refreshToken() {
    const now = Date.now();
    const expiry = this.account.token_expiry ? Number(this.account.token_expiry) : 0;

    if (this.account.access_token && expiry && now < expiry - 60000) {
      return this.account.access_token;
    }

    const rawRefreshToken = decryptSecret(this.account.refresh_token);
    if (!rawRefreshToken) {
      if (this.account.access_token) return this.account.access_token;
      throw new Error(`Account ${this.account.email} has no refresh token. Reconnect via Google OAuth.`);
    }

    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({ refresh_token: rawRefreshToken });

    let tokenResult;
    if (typeof oauth2.refreshAccessToken === 'function') {
      tokenResult = await oauth2.refreshAccessToken();
      tokenResult = tokenResult && tokenResult.credentials ? tokenResult.credentials : tokenResult;
    } else {
      tokenResult = await oauth2.getAccessToken();
    }

    const newAccessToken = typeof tokenResult === 'string'
      ? tokenResult
      : tokenResult?.token || tokenResult?.access_token || this.account.access_token;

    const newExpiry = tokenResult?.res?.data?.expiry_date || tokenResult?.expiry_date || (Date.now() + 3600 * 1000);

    if (!newAccessToken) {
      throw new Error(`Unable to refresh access token for ${this.account.email}`);
    }

    this.account.access_token = newAccessToken;
    this.account.token_expiry = newExpiry;

    try {
      const db = await getDb();
      await db.prepare('UPDATE accounts SET access_token = ?, token_expiry = ? WHERE id = ?')
        .run(newAccessToken, newExpiry, this.account.id);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to persist refreshed token in DB');
    }

    return newAccessToken;
  }

  async validate() {
    try {
      await this.refreshToken();
      return true;
    } catch (_) {
      return false;
    }
  }

  async makeRawEmail(from, to, subject, body, extraHeaders = {}) {
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

    for (const [key, value] of Object.entries(extraHeaders)) {
      if (value) {
        headerLines.push(`${key}: ${value}`);
      }
    }

    const msg = [...headerLines, '', body || ''].join('\r\n');
    return Buffer.from(msg, 'utf-8').toString('base64url');
  }

  async send(to, subject, bodyHtml, extraHeaders = {}) {
    const accessToken = await this.refreshToken();
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const fromAddr = this.account.display_name
      ? `"${this.account.display_name}" <${this.account.email}>`
      : this.account.email;

    const raw = await this.makeRawEmail(fromAddr, to, subject, bodyHtml, extraHeaders);
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return res.data.id || null;
  }

  async getInbox(limit = 50) {
    const accessToken = await this.refreshToken();
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      q: 'is:unread',
      maxResults: limit,
    });

    const messagesList = Array.isArray(listRes.data.messages) ? listRes.data.messages : [];
    const results = [];

    for (const item of messagesList) {
      if (!item || !item.id) continue;
      try {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: item.id,
          format: 'full',
        });

        const payload = msgRes.data.payload || {};
        const headers = Array.isArray(payload.headers) ? payload.headers : [];
        const from = findHeaderValue(headers, 'From');
        const to = findHeaderValue(headers, 'To') || this.account.email;
        const subject = findHeaderValue(headers, 'Subject') || '';

        const senderEmail = parseEmailAddress(from);
        const recipientEmail = parseEmailAddress(to) || this.account.email;
        const { bodyText, bodyHtml } = extractMessageBody(payload);

        results.push({
          messageId: String(msgRes.data.id || item.id),
          senderEmail,
          recipientEmail,
          subject,
          bodyText,
          bodyHtml,
        });
      } catch (err) {
        logger.warn({ err: err.message, id: item.id }, 'Error reading Gmail message');
      }
    }

    return results;
  }
}

module.exports = GmailProvider;
