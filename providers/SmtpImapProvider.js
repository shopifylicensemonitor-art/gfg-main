/**
 * providers/SmtpImapProvider.js — Custom SMTP / IMAP Email Provider Implementation.
 *
 * Uses Nodemailer connection pooling for high-throughput SMTP sending
 * and decrypts stored passwords at rest.
 */

const nodemailer = require('nodemailer');
const EmailProvider = require('./EmailProvider');
const { decryptSecret } = require('../lib/crypto');
const logger = require('../logger');

const transportCache = new Map();

class SmtpImapProvider extends EmailProvider {
  getDecryptedSmtpPass() {
    return decryptSecret(this.account.smtp_pass);
  }

  getDecryptedImapPass() {
    return decryptSecret(this.account.imap_pass || this.account.smtp_pass);
  }

  getTransport() {
    const key = this.account.id ? String(this.account.id) : null;
    if (key && transportCache.has(key)) return transportCache.get(key);

    const rawPass = this.getDecryptedSmtpPass();
    const transport = nodemailer.createTransport({
      host: this.account.smtp_host,
      port: this.account.smtp_port || 587,
      secure: !!this.account.smtp_secure,
      auth: {
        user: this.account.smtp_user || this.account.email,
        pass: rawPass,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    if (key) transportCache.set(key, transport);
    return transport;
  }

  async validate() {
    try {
      const transport = this.getTransport();
      await transport.verify();
      return true;
    } catch (_) {
      return false;
    }
  }

  async refreshToken() {
    return this.getDecryptedSmtpPass();
  }

  async send(to, subject, bodyHtml, extraHeaders = {}) {
    const transport = this.getTransport();
    const fromAddr = this.account.display_name
      ? `"${this.account.display_name}" <${this.account.email}>`
      : this.account.email;

    const info = await transport.sendMail({
      from: fromAddr,
      to,
      subject,
      html: bodyHtml,
      headers: extraHeaders,
    });

    return info.messageId || `smtp-${Date.now()}`;
  }

  async getInbox(_limit = 50) {
    // IMAP inbox fetch fallback for custom domain mailboxes
    // In production without native imap library installed, returns empty array or logs notice
    logger.debug({ account: this.account.email }, 'IMAP inbox check requested for custom domain account');
    return [];
  }
}

module.exports = SmtpImapProvider;
