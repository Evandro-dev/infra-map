import { z } from 'zod';
import type { ObservationStatus } from './monitoring.ts';

export const mapTopologyDiscoveryRequestSchema = z
  .object({ mapId: z.string().trim().min(1).max(100) })
  .strict();

export interface MapTopologyDiscoveryResult {
  mapId: string;
  readOnlySources: true;
  completedAt: string;
  server: {
    name: string | null;
    status: 'OK' | 'UNAVAILABLE' | 'NOT_CONFIGURED';
    queueCount: number;
    identityFieldsFilled: string[];
    printers: Array<{
      deviceId: string;
      name: string;
      status: 'OK' | 'WARNING' | 'UNKNOWN';
      queueStatus: string | null;
      hostAddress: string | null;
      macAddress: string | null;
      macSource: 'ARP_NEIGHBOR' | null;
      macMatchesInventory: boolean | null;
      fieldsFilled: string[];
      summary: string;
    }>;
    warnings: string[];
  };
  computers: Array<{
    deviceId: string;
    name: string;
    host: string;
    status: 'OK' | 'PARTIAL' | 'UNAVAILABLE';
    installedQueueCount: number;
    ignoredQueueCount: number;
    identityFieldsFilled: string[];
    warnings: string[];
  }>;
  relations: Array<{
    computerId: string;
    computerName: string;
    printerId: string | null;
    printerName: string;
    status: 'LINKED' | 'ALREADY_LINKED' | 'UNMATCHED' | 'AMBIGUOUS';
    observationStatus: ObservationStatus | null;
    summary: string;
  }>;
  warnings: string[];
}
