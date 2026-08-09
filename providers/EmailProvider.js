/**
 * providers/EmailProvider.js — Abstract Email Provider Base Class.
 *
 * All provider implementations (GmailProvider, MicrosoftProvider, SmtpImapProvider)
 * inherit from this interface.
 */

class EmailProvider {
  constructor(account) {
    if (new.target === EmailProvider) {
      throw new TypeError('Cannot construct EmailProvider instances directly.');
    }
    this.account = account;
  }

  /**
   * Validate account connection credentials.
   * @returns {Promise<boolean>}
   */
  async validate() {
    throw new Error('EmailProvider.validate() must be implemented by subclass.');
  }

  /**
   * Refresh credentials if expired.
   * @returns {Promise<string>} Fresh access token or connection string
   */
  async refreshToken() {
    throw new Error('EmailProvider.refreshToken() must be implemented by subclass.');
  }

  /**
   * Send an outreach email.
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject line
   * @param {string} bodyHtml - HTML body content
   * @param {object} [extraHeaders] - Optional RFC headers (List-Unsubscribe, etc.)
   * @returns {Promise<string>} Provider message ID
   */
  async send(to, subject, bodyHtml, extraHeaders = {}) {
    throw new Error('EmailProvider.send() must be implemented by subclass.');
  }

  /**
   * Fetch unread inbox messages from provider for reply detection.
   * @param {number} [limit=50] - Maximum messages to retrieve
   * @returns {Promise<Array<{ messageId: string, senderEmail: string, recipientEmail: string, subject: string, bodyText: string, bodyHtml: string }>>}
   */
  async getInbox(limit = 50) {
    throw new Error('EmailProvider.getInbox() must be implemented by subclass.');
  }

  /**
   * Send a direct reply to a received message.
   * @param {string} to - Recipient email address
   * @param {string} subject - Reply subject
   * @param {string} bodyHtml - HTML reply content
   * @param {string} [inReplyToMessageId] - Original Message-ID header
   * @returns {Promise<string>} Provider reply message ID
   */
  async sendReply(to, subject, bodyHtml, inReplyToMessageId = null) {
    return this.send(to, subject, bodyHtml, inReplyToMessageId ? { 'In-Reply-To': inReplyToMessageId } : {});
  }
}

module.exports = EmailProvider;
