import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';

export interface WindowsCredentialSecret {
  username: string;
  password: string;
}

export interface EncryptedCredential {
  payload: Buffer;
  nonce: Buffer;
  authTag: Buffer;
}

function encryptionKey() {
  const value = env.CREDENTIALS_ENCRYPTION_KEY;
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new AppError(
      503,
      'Cofre indisponível. Execute npm run setup para gerar CREDENTIALS_ENCRYPTION_KEY no backend.',
    );
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32)
    throw new AppError(503, 'CREDENTIALS_ENCRYPTION_KEY precisa conter 32 bytes em Base64.');
  return key;
}

export function encryptCredentialSecret(secret: WindowsCredentialSecret): EncryptedCredential {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  const payload = Buffer.concat([cipher.update(JSON.stringify(secret), 'utf8'), cipher.final()]);
  return { payload, nonce, authTag: cipher.getAuthTag() };
}

export function decryptCredentialSecret(encrypted: EncryptedCredential): WindowsCredentialSecret {
  const key = encryptionKey();
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, encrypted.nonce);
    decipher.setAuthTag(encrypted.authTag);
    const payload = Buffer.concat([decipher.update(encrypted.payload), decipher.final()]).toString(
      'utf8',
    );
    const parsed: unknown = JSON.parse(payload);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('username' in parsed) ||
      typeof parsed.username !== 'string' ||
      !('password' in parsed) ||
      typeof parsed.password !== 'string'
    )
      throw new Error('Invalid credential payload');
    return { username: parsed.username, password: parsed.password };
  } catch {
    throw new AppError(
      503,
      'Não foi possível abrir esta credencial. Confira se CREDENTIALS_ENCRYPTION_KEY é a mesma usada ao salvá-la.',
    );
  }
}
