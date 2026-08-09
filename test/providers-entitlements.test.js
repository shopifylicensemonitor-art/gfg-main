const assert = require('assert');
const { encryptSecret, decryptSecret, maskSecret } = require('../lib/crypto');
const { getProviderForAccount, GmailProvider, MicrosoftProvider, SmtpImapProvider } = require('../providers');
const { DEFAULT_PLAN_ENTITLEMENTS } = require('../middleware/entitlements');

async function runTests() {
  console.log('--- Running Phase 3 Unit Tests ---');

  // Test 1: Crypto AES-256-GCM Round-trip
  console.log('Test 1: Crypto AES-256-GCM encryption & decryption');
  const originalSecret = '1//09aB_test_google_refresh_token_xyz';
  const encrypted = encryptSecret(originalSecret);
  assert(encrypted.startsWith('ENC:'), 'Encrypted string must start with ENC:');
  const decrypted = decryptSecret(encrypted);
  assert.strictEqual(decrypted, originalSecret, 'Decrypted secret must match original');
  const masked = maskSecret(encrypted);
  assert(masked.includes('...'), 'Masked string should contain ellipsis');
  console.log('✓ Test 1 Passed');

  // Test 2: Email Provider Factory
  console.log('Test 2: Email Provider Factory (getProviderForAccount)');
  const googleAccount = { type: 'google', email: 'test@gmail.com' };
  const msAccount = { type: 'microsoft', email: 'test@outlook.com' };
  const smtpAccount = { type: 'smtp', smtp_host: 'smtp.sendgrid.net', email: 'outreach@domain.com' };

  const provider1 = getProviderForAccount(googleAccount);
  assert(provider1 instanceof GmailProvider, 'Google account must instantiate GmailProvider');

  const provider2 = getProviderForAccount(msAccount);
  assert(provider2 instanceof MicrosoftProvider, 'Microsoft account must instantiate MicrosoftProvider');

  const provider3 = getProviderForAccount(smtpAccount);
  assert(provider3 instanceof SmtpImapProvider, 'SMTP account must instantiate SmtpImapProvider');
  console.log('✓ Test 2 Passed');

  // Test 3: Plan Entitlements Defaults
  console.log('Test 3: Plan Entitlements Defaults');
  assert.strictEqual(DEFAULT_PLAN_ENTITLEMENTS.free['automation.enabled'], 'false');
  assert.strictEqual(DEFAULT_PLAN_ENTITLEMENTS.free['connected_mailboxes.max'], '0');
  assert.strictEqual(DEFAULT_PLAN_ENTITLEMENTS.free['manual_send.daily_limit'], '50');

  assert.strictEqual(DEFAULT_PLAN_ENTITLEMENTS.pro['automation.enabled'], 'true');
  assert.strictEqual(DEFAULT_PLAN_ENTITLEMENTS.pro['connected_mailboxes.max'], '5');
  assert.strictEqual(DEFAULT_PLAN_ENTITLEMENTS.pro['reply_detection.enabled'], 'true');
  console.log('✓ Test 3 Passed');

  console.log('=== All Phase 3 Unit Tests Passed Successfully! ===');
}

runTests().catch(err => {
  console.error('Phase 3 Unit Test Failure:', err);
  process.exit(1);
});
