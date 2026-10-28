import type {
  CreateWindowsPrintCredential,
  UpdateManagedCredential,
  WindowsCredentials,
} from '@infra/contracts';
import { printServerSchema } from '@infra/contracts';
import { AppError } from '../../shared/errors.js';
import { decryptCredentialSecret, encryptCredentialSecret } from './credential-crypto.js';
import { credentialsRepository } from './credentials.repository.js';

type Summary = Awaited<ReturnType<typeof credentialsRepository.list>>[number];

function normalizedServer(value: string) {
  if (!value) return null;
  return printServerSchema.parse(value);
}

function toSummary(item: Summary) {
  return { ...item, provider: 'WINDOWS_PRINT_SERVER' as const };
}

export const credentialsService = {
  async list() {
    return (await credentialsRepository.list()).map(toSummary);
  },
  async create(input: CreateWindowsPrintCredential) {
    const encrypted = encryptCredentialSecret({
      username: input.username,
      password: input.password,
    });
    const created = await credentialsRepository.create({
      provider: input.provider,
      name: input.name,
      targetServer: normalizedServer(input.targetServer),
      encryptedPayload: encrypted.payload,
      encryptionNonce: encrypted.nonce,
      encryptionAuthTag: encrypted.authTag,
    });
    return toSummary(created);
  },
  async update(id: string, input: UpdateManagedCredential) {
    const current = await credentialsRepository.find(id);
    if (!current) throw new AppError(404, 'Credencial não encontrada.');
    const encrypted = input.replaceAccount
      ? encryptCredentialSecret({ username: input.username, password: input.password })
      : null;
    const updated = await credentialsRepository.update(id, {
      name: input.name,
      targetServer: normalizedServer(input.targetServer),
      ...(encrypted
        ? {
            encryptedPayload: encrypted.payload,
            encryptionNonce: encrypted.nonce,
            encryptionAuthTag: encrypted.authTag,
          }
        : {}),
    });
    return toSummary(updated);
  },
  async remove(id: string) {
    const current = await credentialsRepository.find(id);
    if (!current) throw new AppError(404, 'Credencial não encontrada.');
    await credentialsRepository.delete(id);
  },
  async resolveWindowsPrintServer(
    id: string,
    requestedServer: string,
  ): Promise<WindowsCredentials> {
    const current = await credentialsRepository.find(id);
    if (!current) throw new AppError(404, 'Credencial não encontrada.');
    if (current.provider !== 'WINDOWS_PRINT_SERVER')
      throw new AppError(400, 'Esta credencial não pode consultar um servidor de impressão.');
    const target = normalizedServer(requestedServer);
    if (
      current.targetServer &&
      target &&
      current.targetServer.toLocaleLowerCase('en-US') !== target.toLocaleLowerCase('en-US')
    )
      throw new AppError(400, 'Esta credencial foi cadastrada para outro servidor de impressão.');
    return decryptCredentialSecret({
      payload: Buffer.from(current.encryptedPayload),
      nonce: Buffer.from(current.encryptionNonce),
      authTag: Buffer.from(current.encryptionAuthTag),
    });
  },
};
