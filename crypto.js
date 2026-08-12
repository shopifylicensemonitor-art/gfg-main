/**
 * crypto.js — Symmetric encryption for credentials stored at rest.
 *
 * Uses AES-256-GCM. The key comes from ENCRYPTION_KEY (any length string,
 * hashed to 32 bytes) and falls back to JWT_SECRET so existing deployments
 * keep working without extra configuration.
 *
 * Encrypted values are stored as: enc:v1:<iv-b64>:<tag-b64>:<ciphertext-b64>
 * Anything without that prefix is treated as legacy plaintext and returned
 * as-is, so migration is transparent.
 */

const crypto = require('crypto');

const PREFIX = 'enc:v1:';

function getKey() {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'peakxender-dev-secret-change-me';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/** Encrypt a string. Returns null/undefined untouched. */
function encrypt(value) {
  if (value === null || value === undefined || value === '') return value;
  const str = String(value);
  if (str.startsWith(PREFIX)) return str; // already encrypted
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    iv.toString('base64') + ':' + tag.toString('base64') + ':' + ciphertext.toString('base64')
  );
}

/** Decrypt a value produced by encrypt(). Plaintext passes through. */
function decrypt(value) {
  if (value === null || value === undefined || value === '') return value;
  const str = String(value);
  if (!str.startsWith(PREFIX)) return str; // legacy plaintext
  try {
    const [ivB64, tagB64, dataB64] = str.slice(PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getKey(),
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (_) {
    // Wrong key or corrupted payload — surface as missing rather than crashing.
    return null;
  }
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

module.exports = { encrypt, decrypt, isEncrypted };
