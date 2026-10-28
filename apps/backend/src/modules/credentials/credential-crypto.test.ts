import { describe, expect, it } from 'vitest';
import { decryptCredentialSecret, encryptCredentialSecret } from './credential-crypto.js';

describe('credential secret encryption', () => {
  it('encrypts credentials and restores them only with the local key', () => {
    const secret = { username: 'DOMAIN\u005coperator', password: 'test-only-password' };
    const encrypted = encryptCredentialSecret(secret);

    expect(encrypted.payload.includes(Buffer.from(secret.password))).toBe(false);
    expect(decryptCredentialSecret(encrypted)).toEqual(secret);
  });

  it('rejects modified ciphertext', () => {
    const encrypted = encryptCredentialSecret({
      username: 'operator',
      password: 'test-only-password',
    });
    const modified = Buffer.from(encrypted.payload);
    modified[0] ^= 1;

    expect(() => decryptCredentialSecret({ ...encrypted, payload: modified })).toThrow(
      'Não foi possível abrir esta credencial.',
    );
  });
});
