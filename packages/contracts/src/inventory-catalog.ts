import { z } from 'zod';
import { windowsNetworkAdapterSchema } from './monitoring.ts';

export const printServerSchema = z
  .string()
  .trim()
  .transform((value) => (value.startsWith('\\\\') ? value.slice(2) : value))
  .pipe(
    z
      .string()
      .min(1)
      .max(180)
      .regex(
        /^(?=.{1,180}$)[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i,
        'Informe um nome de servidor ou IPv4, sem caminho de compartilhamento, espaços ou comandos.',
      ),
  );

export function samePrintServer(left: string, right: string) {
  const normalizedLeft = printServerSchema.safeParse(left);
  const normalizedRight = printServerSchema.safeParse(right);
  return (
    normalizedLeft.success &&
    normalizedRight.success &&
    normalizedLeft.data.toLocaleLowerCase('en-US') ===
      normalizedRight.data.toLocaleLowerCase('en-US')
  );
}

const optionalText = z.string().trim().max(400).nullable();
export const printSnapshotSchema = z
  .object({
    server: printServerSchema,
    source: z.enum(['WINDOWS', 'REFERENCE']),
    collectedAt: z.iso.datetime(),
    referenceDate: z.iso.date().nullable().default(null),
    serverIdentity: z
      .object({
        hostname: optionalText,
        manufacturer: optionalText,
        model: optionalText,
        serialNumber: optionalText,
        operatingSystem: optionalText,
        ipAddress: z.union([z.ipv4(), z.ipv6()]).nullable(),
        macAddress: z.string().max(40).nullable(),
        networkAdapters: z.array(windowsNetworkAdapterSchema).max(32),
      })
      .strict()
      .nullable()
      .optional(),
    queues: z
      .array(
        z
          .object({
            name: z.string().min(1).max(180),
            shareName: optionalText,
            driverName: optionalText,
            portName: optionalText,
            hostAddress: optionalText,
            protocol: optionalText,
            portNumber: z.number().int().min(1).max(65535).nullable(),
            shared: z.boolean(),
            status: z.string().max(100).nullable().optional(),
            location: optionalText,
          })
          .strict(),
      )
      .max(5000),
    drivers: z
      .array(
        z
          .object({
            name: z.string().min(1).max(180),
            manufacturer: optionalText,
            environment: optionalText,
          })
          .strict(),
      )
      .max(5000),
    ports: z
      .array(
        z
          .object({
            name: z.string().min(1).max(180),
            hostAddress: optionalText,
            protocol: optionalText,
            portNumber: z.number().int().min(1).max(65535).nullable(),
          })
          .strict(),
      )
      .max(5000),
    warnings: z.array(z.string().max(400)).max(30),
  })
  .strict();
export type PrintSnapshot = z.infer<typeof printSnapshotSchema>;
export type PrintServerIdentity = NonNullable<PrintSnapshot['serverIdentity']>;

export const inventoryCatalogFields = [
  'manufacturer',
  'model',
  'hostname',
  'operatingSystem',
  'assignedUser',
  'printServer',
  'printQueue',
  'printShare',
  'approvedDriver',
  'printPort',
  'printProtocol',
] as const;
export type InventoryCatalogField = (typeof inventoryCatalogFields)[number];
export interface CatalogOption {
  value: string;
  source: 'INVENTORY' | 'WINDOWS' | 'REFERENCE';
  server: string | null;
  collectedAt: string | null;
}
export type CatalogQueue = PrintSnapshot['queues'][number] & {
  key: string;
  server: string;
  source: CatalogOption['source'];
  collectedAt: string | null;
};
export type CatalogPort = PrintSnapshot['ports'][number] & {
  key: string;
  server: string;
  source: CatalogOption['source'];
  collectedAt: string | null;
};
export interface PrintSnapshotSummary {
  server: string;
  source: PrintSnapshot['source'];
  collectedAt: string;
  referenceDate: string | null;
  queueCount: number;
  warnings: string[];
}
