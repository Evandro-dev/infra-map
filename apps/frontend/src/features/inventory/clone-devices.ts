import { api } from '@/lib/api';
import type { Device } from '@/lib/types';

/** Creates independent inventory records for copied device nodes in one request. */
export function cloneInventoryDevices(ids: string[]) {
  if (!ids.length) return Promise.resolve({} satisfies Record<string, Device>);
  return api<Record<string, Device>>('/devices/clone', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}
