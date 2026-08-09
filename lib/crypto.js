/**
 * lib/crypto.js — Shared AES-256-GCM Secret Encryption Module.
 *
 * Used for encrypting sensitive credentials at rest:
 *   - Google OAuth refresh tokens
 *   - Microsoft OAuth refresh tokens
 *   - SMTP passwords
 *   - IMAP passwords
 *   - AI provider API keys
 */

const crypto = require('crypto');
const logger = require('../logger');

const KEY_SOURCE = process.env.ENCRYPTION_KEY || process.env.AI_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-fallback-master-encryption-key-32b';
const MASTER_KEY = crypto.createHash('sha256').update(String(KEY_SOURCE)).digest(); // 32 bytes

/**
 * Encrypt a plain text secret using AES-256-GCM.
 * Returns `ENC:<ivHex>:<tagHex>:<cipherHex>`
 */
function encryptSecret(plainText) {
  if (!plainText) return '';
  if (typeof plainText !== 'string') plainText = String(plainText);
  if (plainText.startsWith('ENC:')) return plainText; // already encrypted

  try {
    const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(plainText, 'utf-8')), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `ENC:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    logger.error({ err: err.message }, 'encryptSecret failed');
    throw new Error('Encryption error');
  }
}

/**
 * Decrypt an AES-256-GCM encrypted secret.
 */
function decryptSecret(encText) {
  if (!encText) return '';
  if (typeof encText !== 'string') return String(encText);
  if (!encText.startsWith('ENC:')) return encText; // legacy plain text or unencrypted

  try {
    const parts = encText.split(':');
    if (parts.length !== 4) return encText;
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const cipherText = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch (err) {
    logger.error({ err: err.message }, 'decryptSecret failed');
    return '';
  }
}

/**
 * Mask a secret string for safe display in UI/logs.
 */
function maskSecret(secret) {
  if (!secret) return '';
  const plain = decryptSecret(secret);
  if (plain.length <= 8) return '********';
  return plain.slice(0, 4) + '...' + plain.slice(-4);
}

module.exports = {
  encryptSecret,
  decryptSecret,
  maskSecret,
};
