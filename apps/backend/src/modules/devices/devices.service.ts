import type { z } from 'zod';
import { newDeviceSchema, updateDeviceSchema } from '@infra/contracts';
import { devicesRepository } from './devices.repository.js';

export const devicesService = {
  list: () => devicesRepository.list(),
  create: (data: z.infer<typeof newDeviceSchema>) => devicesRepository.create(data),
  cloneMany: (ids: string[]) => devicesRepository.cloneMany(ids),
  update: (id: string, data: z.infer<typeof updateDeviceSchema>) =>
    devicesRepository.update(id, data),
};
