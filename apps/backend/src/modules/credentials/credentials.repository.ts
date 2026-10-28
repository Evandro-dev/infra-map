import { prisma } from '@infra/database';

export const credentialsRepository = {
  list() {
    return prisma.managedCredential.findMany({
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        provider: true,
        name: true,
        targetServer: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
  find(id: string) {
    return prisma.managedCredential.findUnique({ where: { id } });
  },
  create(input: {
    provider: string;
    name: string;
    targetServer: string | null;
    encryptedPayload: Uint8Array;
    encryptionNonce: Uint8Array;
    encryptionAuthTag: Uint8Array;
  }) {
    return prisma.managedCredential.create({
      data: {
        ...input,
        encryptedPayload: Uint8Array.from(input.encryptedPayload),
        encryptionNonce: Uint8Array.from(input.encryptionNonce),
        encryptionAuthTag: Uint8Array.from(input.encryptionAuthTag),
      },
      select: {
        id: true,
        provider: true,
        name: true,
        targetServer: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
  update(
    id: string,
    input: {
      name: string;
      targetServer: string | null;
      encryptedPayload?: Uint8Array;
      encryptionNonce?: Uint8Array;
      encryptionAuthTag?: Uint8Array;
    },
  ) {
    const data = {
      name: input.name,
      targetServer: input.targetServer,
      ...(input.encryptedPayload && input.encryptionNonce && input.encryptionAuthTag
        ? {
            encryptedPayload: new Uint8Array(input.encryptedPayload),
            encryptionNonce: new Uint8Array(input.encryptionNonce),
            encryptionAuthTag: new Uint8Array(input.encryptionAuthTag),
          }
        : {}),
    };
    return prisma.managedCredential.update({
      where: { id },
      data,
      select: {
        id: true,
        provider: true,
        name: true,
        targetServer: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
  delete(id: string) {
    return prisma.managedCredential.delete({ where: { id }, select: { id: true } });
  },
};
