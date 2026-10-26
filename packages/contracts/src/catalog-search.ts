import { z } from 'zod';
import {
  inventoryCatalogFields,
  printServerSchema,
  type CatalogOption,
  type CatalogQueue,
  type CatalogPort,
  type PrintSnapshotSummary,
} from './inventory-catalog.ts';

export const catalogSearchSchema = z
  .object({
    field: z.enum(inventoryCatalogFields),
    kind: z
      .enum(['COMPUTER', 'PRINTER', 'SCALE', 'CAMERA', 'SERVER', 'SWITCH', 'UPS', 'PDV', 'OTHER'])
      .optional(),
    server: z.string().trim().max(180).default(''),
    search: z.string().trim().max(180).default(''),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type CatalogSearch = z.infer<typeof catalogSearchSchema>;
export interface CatalogSearchItem extends CatalogOption {
  key: string;
  queue?: CatalogQueue;
  port?: CatalogPort;
}
export interface CatalogSearchPage {
  items: CatalogSearchItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}
export interface CatalogSummary {
  defaultServer: string | null;
  snapshots: PrintSnapshotSummary[];
}
export interface PrintDiscoveryResult {
  server: string;
  source: 'WINDOWS' | 'REFERENCE';
  collectedAt: string;
  queueCount: number;
  driverCount: number;
  portCount: number;
  warnings: string[];
}

const windowsCredentialsSchema = z
  .object({
    username: z.string().trim().min(1).max(180),
    password: z.string().min(1).max(512),
  })
  .strict();
export type WindowsCredentials = z.infer<typeof windowsCredentialsSchema>;
export const printDiscoveryRequestSchema = z
  .object({
    server: printServerSchema,
    credentials: windowsCredentialsSchema.optional(),
  })
  .strict();
