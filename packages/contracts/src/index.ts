import { z } from 'zod';
export { monitorConfigSchema, windowsComputerReportSchema } from './monitoring.ts';
export type {
  MonitorConfig,
  MonitorSource,
  ObservationStatus,
  MonitorState,
  MonitorObservation,
  DeviceHealth,
  MonitorDetail,
  PrinterRelationHealth,
  WindowsComputerReport,
} from './monitoring.ts';
export { catalogSearchSchema, printDiscoveryRequestSchema } from './catalog-search.ts';
export type {
  CatalogSearch,
  CatalogSearchItem,
  CatalogSearchPage,
  CatalogSummary,
  WindowsCredentials,
  PrintDiscoveryResult,
} from './catalog-search.ts';
export {
  managedCredentialProviderSchema,
  createWindowsPrintCredentialSchema,
  updateManagedCredentialSchema,
} from './credentials.ts';
export type {
  ManagedCredentialProvider,
  CreateWindowsPrintCredential,
  UpdateManagedCredential,
  ManagedCredentialSummary,
} from './credentials.ts';
export {
  supportActionSchema,
  supportExecutionSchema,
  islLinkSchema,
  printerConfigSchema,
} from './support.ts';
export type {
  SupportAction,
  SupportSettings,
  IslComputer,
  IslPresence,
  PrinterConfiguration,
} from './support.ts';
export { printerImportSchema } from './printer-import.ts';
export type { PrinterImportResult } from './printer-import.ts';
export {
  printServerSchema,
  printSnapshotSchema,
  inventoryCatalogFields,
} from './inventory-catalog.ts';
export type {
  PrintSnapshot,
  CatalogOption,
  CatalogQueue,
  CatalogPort,
  InventoryCatalogField,
} from './inventory-catalog.ts';
export const deviceKindSchema = z.enum([
  'COMPUTER',
  'PRINTER',
  'SCALE',
  'CAMERA',
  'SERVER',
  'SWITCH',
  'UPS',
  'PDV',
  'OTHER',
]);
export const newDeviceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: deviceKindSchema,
  model: z.string().max(120).optional(),
  ipAddress: z.union([z.ipv4(), z.ipv6(), z.literal('')]).optional(),
  assetTag: z.string().max(100).optional(),
});
export const cloneDevicesSchema = z
  .object({
    ids: z.array(z.string().trim().min(1).max(80)).min(1).max(3000),
  })
  .strict()
  .refine((value) => new Set(value.ids).size === value.ids.length, {
    message: 'A lista contém dispositivos repetidos.',
  });
export const updateDeviceSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    model: z.string().max(120).nullable().optional(),
    printServer: z.string().max(180).nullable().optional(),
    printShare: z.string().max(180).nullable().optional(),
    approvedDriver: z.string().max(180).nullable().optional(),
    printQueue: z.string().trim().max(180).nullable().optional(),
    printPort: z.string().trim().max(180).nullable().optional(),
    printProtocol: z.string().trim().max(40).nullable().optional(),
    printPortNumber: z.number().int().min(1).max(65535).nullable().optional(),
    ipAddress: z
      .union([z.ipv4(), z.ipv6(), z.literal('')])
      .nullable()
      .optional(),
    assetTag: z.string().max(100).nullable().optional(),
    manufacturer: z.string().max(120).nullable().optional(),
    serialNumber: z.string().max(120).nullable().optional(),
    macAddress: z.string().max(40).nullable().optional(),
    hostname: z.string().max(160).nullable().optional(),
    operatingSystem: z.string().max(160).nullable().optional(),
    assignedUser: z.string().max(160).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    status: z.enum(['UNKNOWN', 'ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE']).optional(),
  })
  .strict();
export const mapElementSchema = z.object({
  id: z.string().min(1).max(80),
  parentId: z.string().nullable(),
  deviceId: z.string().nullable(),
  kind: z.enum(['AREA', 'DEVICE']),
  name: z.string().trim().min(1).max(140),
  iconKey: z.string().max(80).nullable(),
  xMeters: z.number().finite().min(-100000).max(100000),
  yMeters: z.number().finite().min(-100000).max(100000),
  widthMeters: z.number().finite().gt(0).max(100000),
  heightMeters: z.number().finite().gt(0).max(100000),
  level: z.number().int().min(-50).max(200),
  orderIndex: z.number().int().min(0).max(100000).optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
});
export const layoutSchema = z.object({
  name: z.string().trim().min(1).max(140),
  widthMeters: z.number().finite().gt(0).max(100000),
  heightMeters: z.number().finite().gt(0).max(100000),
  hasTerritory: z.boolean().optional(),
  originXMeters: z.number().finite().min(-100000).max(100000).optional(),
  originYMeters: z.number().finite().min(-100000).max(100000).optional(),
  elements: z.array(mapElementSchema).max(3000),
});
export type MapElementInput = z.infer<typeof mapElementSchema>;
export type DeviceKind = z.infer<typeof deviceKindSchema>;
