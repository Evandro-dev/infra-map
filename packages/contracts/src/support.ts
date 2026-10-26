import { z } from 'zod';

export const supportActionSchema = z.enum([
  'spooler_status',
  'printer_inventory',
  'printer_jobs',
  'restart_spooler',
  'clear_spooler',
]);
export type SupportAction = z.infer<typeof supportActionSchema>;

export const supportExecutionSchema = z
  .object({
    action: supportActionSchema,
    accessPassword: z.string().min(1).max(512),
    confirm: z.literal(true),
    confirmDataLoss: z.boolean().default(false),
  })
  .strict();

export const islLinkSchema = z
  .object({
    islComputerId: z.string().min(1).max(1024),
    islComputerName: z.string().max(200).optional(),
  })
  .strict();

export const printerConfigSchema = z
  .object({
    printServer: z.string().trim().max(180).nullable().optional(),
    printShare: z.string().trim().max(180).nullable().optional(),
    approvedDriver: z.string().trim().max(180).nullable().optional(),
    printQueue: z.string().trim().max(180).nullable().optional(),
    printPort: z.string().trim().max(180).nullable().optional(),
    printProtocol: z.string().trim().max(40).nullable().optional(),
    printPortNumber: z.number().int().min(1).max(65535).nullable().optional(),
    ipAddress: z.union([z.ipv4(), z.ipv6()]).nullable().optional(),
  })
  .strict();

export type PrinterConfiguration = z.infer<typeof printerConfigSchema>;

export interface IslComputer {
  id: string;
  name: string;
  status: string;
  hostName: string | null;
}

export interface SupportSettings {
  mode: 'disabled' | 'hosted' | 'self-hosted';
  configured: boolean;
  server: string | null;
  remoteExecuteEnabled: boolean;
  localLauncherReady: boolean;
  actions: Array<{
    id: string;
    name: string;
    risk: 'READ' | 'CHANGE' | 'ASSISTED';
    detail: string;
  }>;
}

export interface IslPresence {
  source: 'ISL';
  checkedAt: string;
  computer: IslComputer | null;
}
