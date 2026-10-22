import crypto from 'crypto';
import { config } from './config.ts';

// Ensure 32-byte key for AES-256
function getDerivedKey(keyString: string): Buffer {
  return crypto.createHash('sha256').update(keyString).digest();
}

const masterKey = getDerivedKey(config.tokenEncryptionKey);

export interface EncryptedPayload {
  ciphertext: string; // hex
  iv: string;         // hex
  tag: string;        // hex
}

export function encryptToken(token: string): EncryptedPayload {
  if (!token) throw new Error('Cannot encrypt empty token');
  const iv = crypto.randomBytes(12); // standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

export function decryptToken(payload: { ciphertext: string; iv: string; tag: string }): string {
  if (!payload.ciphertext || !payload.iv || !payload.tag) {
    throw new Error('Invalid encrypted payload');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    masterKey,
    Buffer.from(payload.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));

  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateSecureState(): string {
  return crypto.randomBytes(24).toString('hex');
}
