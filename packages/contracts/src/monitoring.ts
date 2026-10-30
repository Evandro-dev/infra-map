import { z } from 'zod';

export const monitorConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    intervalSeconds: z.number().int().min(30).max(3600).default(60),
    timeoutSeconds: z.number().int().min(1).max(15).default(5),
    useIsl: z.boolean().default(false),
    useWindows: z.boolean().default(false),
    usePrintServer: z.boolean().default(false),
    useTcp: z.boolean().default(false),
    tcpPort: z.number().int().min(1).max(65535).nullable().default(null),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.enabled &&
      !value.useIsl &&
      !value.useWindows &&
      !value.usePrintServer &&
      !value.useTcp
    )
      ctx.addIssue({ code: 'custom', message: 'Selecione pelo menos uma fonte de monitoramento.' });
    if (value.useTcp && !value.tcpPort)
      ctx.addIssue({
        code: 'custom',
        path: ['tcpPort'],
        message: 'Informe uma porta TCP conhecida.',
      });
  });
export type MonitorConfig = z.infer<typeof monitorConfigSchema>;
export type MonitorSource = 'ISL' | 'WINDOWS' | 'PRINT_SERVER' | 'TCP' | 'PING' | 'ISL_DIAGNOSTIC';
export type ObservationStatus = 'OK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN' | 'UNAVAILABLE';
export type MonitorState =
  'OK' | 'WARNING' | 'CRITICAL' | 'PARTIAL' | 'UNKNOWN' | 'STALE' | 'DISABLED';
export interface PrinterRelationHealth {
  printerId: string;
  printerName: string;
  relationType?: 'LOCAL' | 'SHARED';
  status: ObservationStatus;
  summary: string;
  expectedQueue?: string;
  observedQueue?: string | null;
  expectedPort?: string | null;
  observedPort?: string | null;
  expectedDriver: string | null;
  observedDriver: string | null;
}
export interface MonitorObservation {
  id: string;
  deviceId: string;
  source: MonitorSource;
  status: ObservationStatus;
  summary: string;
  checkedAt: string;
  data: Record<string, unknown>;
}
export interface DeviceHealth {
  deviceId: string;
  enabled: boolean;
  state: MonitorState;
  summary: string;
  checkedAt: string | null;
  observations: MonitorObservation[];
  relations: PrinterRelationHealth[];
}
export interface MonitorDetail {
  config: MonitorConfig;
  saved: boolean;
  health: DeviceHealth;
  history: MonitorObservation[];
  lastRunAt: string | null;
  nextRunAt: string | null;
}
export const windowsNetworkAdapterSchema = z
  .object({
    name: z.string().nullable(),
    macAddress: z.string().nullable(),
    ipv4Addresses: z.array(z.string()).max(32),
    subnetMasks: z.array(z.string()).max(32),
    defaultGateways: z.array(z.string()).max(16),
    dnsServers: z.array(z.string()).max(32),
  })
  .strict();
export const windowsComputerIdentitySchema = z
  .object({
    hostname: z.string().nullable(),
    manufacturer: z.string().nullable(),
    model: z.string().nullable(),
    serialNumber: z.string().nullable(),
  })
  .strict();
export type WindowsComputerIdentity = z.infer<typeof windowsComputerIdentitySchema>;
export type WindowsNetworkAdapter = z.infer<typeof windowsNetworkAdapterSchema>;
export const windowsComputerReportSchema = z
  .object({
    target: z.string().min(1),
    identity: windowsComputerIdentitySchema.nullable().optional(),
    networkAdapters: z.array(windowsNetworkAdapterSchema).max(32).optional(),
    spooler: z.string().nullable(),
    osCaption: z.string().nullable(),
    uptimeHours: z.number().nonnegative().nullable(),
    freeMemoryPercent: z.number().min(0).max(100).nullable(),
    disks: z
      .array(z.object({ name: z.string(), freePercent: z.number().min(0).max(100) }))
      .max(100),
    printers: z
      .array(
        z.object({
          Name: z.string(),
          DriverName: z.string().nullable(),
          PortName: z.string().nullable(),
          ComputerName: z.string().nullable(),
          ShareName: z.string().nullable(),
        }),
      )
      .max(2000),
    printersAvailable: z.boolean(),
    warnings: z.array(z.string()).max(20),
  })
  .strict();
export type WindowsComputerReport = z.infer<typeof windowsComputerReportSchema>;
