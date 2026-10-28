import type { z } from 'zod';
import { newDeviceSchema, updateDeviceSchema } from '@infra/contracts';
import { devicesRepository } from './devices.repository.js';
import { credentialsService } from '../credentials/credentials.service.js';
import { AppError } from '../../shared/errors.js';

export const devicesService = {
  list: () => devicesRepository.list(),
  create: (data: z.infer<typeof newDeviceSchema>) => devicesRepository.create(data),
  cloneMany: (ids: string[]) => devicesRepository.cloneMany(ids),
  async update(id: string, data: z.infer<typeof updateDeviceSchema>) {
    const existing = await devicesRepository.findForUpdate(id);
    if (!existing) return null;
    const credentialId = data.credentialId === undefined ? existing.credentialId : data.credentialId;
    if (credentialId) {
      const server = data.printServer === undefined ? existing.printServer : data.printServer;
      if (existing.kind !== 'PRINTER' || !server)
        throw new AppError(
          400,
          'Vincule uma credencial de servidor somente a uma impressora com servidor cadastrado.',
        );
      await credentialsService.validateDeviceAssignment(credentialId, server);
    }
    return devicesRepository.update(id, data);
  },
};
