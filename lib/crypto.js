/**
 * lib/crypto.js — UNIFIED AES-256-GCM Secret Encryption Module
 *
 * Supports BOTH encryption formats for seamless database sharing:
 *   - New format: enc:v1:<iv-b64>:<tag-b64>:<ciphertext-b64>
 *   - Legacy format: ENC:<iv-hex>:<tag-hex>:<ciphertext-hex>
 * 
 * New secrets encrypted with enc:v1 format (URL-safe base64).
 * Existing ENC: format secrets automatically handled.
 */

const crypto = require('crypto');
const logger = require('../logger');

const PREFIX_NEW = 'enc:v1:';
const PREFIX_LEGACY = 'ENC:';

const KEY_SOURCE = process.env.ENCRYPTION_KEY || process.env.AI_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-fallback-master-encryption-key-32b';
const MASTER_KEY = crypto.createHash('sha256').update(String(KEY_SOURCE)).digest(); // 32 bytes

/**
 * Encrypt a plain text secret using AES-256-GCM.
 * New format: enc:v1:<iv-b64>:<tag-b64>:<ciphertext-b64>
 */
function encryptSecret(plainText) {
  if (!plainText) return '';
  if (typeof plainText !== 'string') plainText = String(plainText);
  if (plainText.startsWith(PREFIX_NEW) || plainText.startsWith(PREFIX_LEGACY)) return plainText;

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(plainText, 'utf-8')), cipher.final()]);
    const tag = cipher.getAuthTag();
    return (
      PREFIX_NEW +
      iv.toString('base64') + ':' + tag.toString('base64') + ':' + encrypted.toString('base64')
    );
  } catch (err) {
    logger.error({ err: err.message }, 'encryptSecret failed');
    throw new Error('Encryption error');
  }
}

/**
 * Decrypt an AES-256-GCM encrypted secret.
 * Supports both enc:v1 (base64) and ENC: (hex) formats.
 */
function decryptSecret(encText) {
  if (!encText) return '';
  if (typeof encText !== 'string') return String(encText);

  // New format: enc:v1:<b64>:<b64>:<b64>
  if (encText.startsWith(PREFIX_NEW)) {
    try {
      const [ivB64, tagB64, dataB64] = encText.slice(PREFIX_NEW.length).split(':');
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        MASTER_KEY,
        Buffer.from(ivB64, 'base64')
      );
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
      ]).toString('utf-8');
    } catch (err) {
      logger.warn({ err: err.message }, 'decryptSecret (enc:v1) failed');
      return '';
    }
  }

  // Legacy format: ENC:<hex>:<hex>:<hex>
  if (encText.startsWith(PREFIX_LEGACY)) {
    try {
      const parts = encText.split(':');
      if (parts.length !== 4) return encText;
      const iv = Buffer.from(parts[1], 'hex');
      const tag = Buffer.from(parts[2], 'hex');
      const cipherText = Buffer.from(parts[3], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf-8');
    } catch (err) {
      logger.warn({ err: err.message }, 'decryptSecret (ENC:) failed');
      return '';
    }
  }

  // Plain text (legacy or unencrypted)
  return encText;
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

// Aliases for backward compatibility and multi-codebase support
const encrypt = encryptSecret;
const decrypt = decryptSecret;

module.exports = {
  encryptSecret,
  decryptSecret,
  encrypt,      // For Google-new compatibility
  decrypt,      // For Google-new compatibility
  maskSecret,
};
