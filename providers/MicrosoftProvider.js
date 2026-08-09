/**
 * providers/MicrosoftProvider.js — Microsoft Graph API Provider Implementation.
 *
 * Connects Outlook / Microsoft 365 mailboxes via Microsoft Entra OAuth 2.0.
 * Scopes: Mail.Send, Mail.Read, User.Read, offline_access
 */

const EmailProvider = require('./EmailProvider');
const { decryptSecret, encryptSecret } = require('../lib/crypto');
const { getDb } = require('../db');
const logger = require('../logger');

const MS_AUTH_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const MS_GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0';

class MicrosoftProvider extends EmailProvider {
  async refreshToken() {
    const now = Date.now();
    const expiry = this.account.token_expiry ? Number(this.account.token_expiry) : 0;

    if (this.account.access_token && expiry && now < expiry - 60000) {
      return this.account.access_token;
    }

    const rawRefreshToken = decryptSecret(this.account.refresh_token);
    if (!rawRefreshToken) {
      if (this.account.access_token) return this.account.access_token;
      throw new Error(`Account ${this.account.email} has no Microsoft refresh token. Reconnect via Microsoft OAuth.`);
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/api/accounts/microsoft/callback';

    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth not configured: MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are required.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: rawRefreshToken,
      grant_type: 'refresh_token',
      redirect_uri: redirectUri,
      scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access',
    });

    const res = await fetch(`${MS_AUTH_ENDPOINT}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(`Microsoft token refresh failed: ${data.error_description || data.error || res.statusText}`);
    }

    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token ? encryptSecret(data.refresh_token) : this.account.refresh_token;
    const newExpiry = Date.now() + (data.expires_in || 3600) * 1000;

    this.account.access_token = newAccessToken;
    this.account.refresh_token = newRefreshToken;
    this.account.token_expiry = newExpiry;

    try {
      const db = await getDb();
      await db.prepare('UPDATE accounts SET access_token = ?, refresh_token = ?, token_expiry = ? WHERE id = ?')
        .run(newAccessToken, newRefreshToken, newExpiry, this.account.id);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to persist refreshed Microsoft token');
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

  async send(to, subject, bodyHtml, extraHeaders = {}) {
    const accessToken = await this.refreshToken();

    const messagePayload = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: bodyHtml,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      },
      saveToSentItems: 'true',
    };

    const res = await fetch(`${MS_GRAPH_ENDPOINT}/me/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    if (!res.ok && res.status !== 202) {
      const errText = await res.text();
      throw new Error(`Microsoft Graph send error (${res.status}): ${errText}`);
    }

    return `ms-${Date.now()}`;
  }

  async getInbox(limit = 50) {
    const accessToken = await this.refreshToken();

    const res = await fetch(`${MS_GRAPH_ENDPOINT}/me/messages?$filter=isRead eq false&$top=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Microsoft Graph getInbox failed (${res.status})`);
    }

    const data = await res.json();
    const value = Array.isArray(data.value) ? data.value : [];

    return value.map(msg => ({
      messageId: msg.id,
      senderEmail: (msg.from?.emailAddress?.address || '').toLowerCase(),
      recipientEmail: (this.account.email || '').toLowerCase(),
      subject: msg.subject || '',
      bodyText: msg.bodyPreview || '',
      bodyHtml: msg.body?.content || msg.bodyPreview || '',
    }));
  }
}

module.exports = MicrosoftProvider;
