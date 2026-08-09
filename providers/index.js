/**
 * providers/index.js — Email Provider Factory.
 *
 * Instantiates and returns the appropriate EmailProvider subclass
 * based on account type (`oauth`, `google`, `microsoft`, `smtp`).
 */

const GmailProvider = require('./GmailProvider');
const MicrosoftProvider = require('./MicrosoftProvider');
const SmtpImapProvider = require('./SmtpImapProvider');

function getProviderForAccount(account) {
  if (!account) {
    throw new Error('No account provided to getProviderForAccount');
  }

  const type = String(account.type || '').toLowerCase();

  if (type === 'microsoft' || type === 'outlook' || type === 'm365') {
    return new MicrosoftProvider(account);
  }

  if (type === 'smtp' || account.smtp_host) {
    return new SmtpImapProvider(account);
  }

  if (type === 'oauth' || type === 'google') {
    return new GmailProvider(account);
  }

  throw new Error(`Unsupported sender account type: "${account.type}"`);
}

module.exports = {
  getProviderForAccount,
  GmailProvider,
  MicrosoftProvider,
  SmtpImapProvider,
};
