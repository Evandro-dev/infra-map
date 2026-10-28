export interface DeviceCloneInput {
  name: string;
  kind: string;
  model: string | null;
  manufacturer: string | null;
  operatingSystem: string | null;
  printServer: string | null;
  printShare: string | null;
  approvedDriver: string | null;
  printQueue: string | null;
  printPort: string | null;
  printProtocol: string | null;
  printPortNumber: number | null;
  monitoring: {
    intervalSeconds: number;
    timeoutSeconds: number;
    useIsl: boolean;
    useWindows: boolean;
    usePrintServer: boolean;
    useTcp: boolean;
    tcpPort: number | null;
  } | null;
}

export function cloneDeviceData(source: DeviceCloneInput) {
  const suffix = ' (cópia)';
  return {
    name: `${source.name.slice(0, 120 - suffix.length)}${suffix}`,
    kind: source.kind,
    model: source.model,
    manufacturer: source.manufacturer,
    operatingSystem: source.operatingSystem,
    printServer: source.printServer,
    printShare: source.printShare,
    approvedDriver: source.approvedDriver,
    printQueue: source.printQueue,
    printPort: source.printPort,
    printProtocol: source.printProtocol,
    printPortNumber: source.printPortNumber,
    ipAddress: null,
    assetTag: null,
    serialNumber: null,
    macAddress: null,
    hostname: null,
    assignedUser: null,
    notes: null,
    status: 'UNKNOWN',
    islComputerId: null,
    islComputerName: null,
  };
}

export function cloneMonitorData(source: DeviceCloneInput['monitoring'], deviceId: string) {
  if (!source) return null;
  return {
    deviceId,
    enabled: false,
    intervalSeconds: source.intervalSeconds,
    timeoutSeconds: source.timeoutSeconds,
    useIsl: source.useIsl,
    useWindows: source.useWindows,
    usePrintServer: source.usePrintServer,
    useTcp: source.useTcp,
    tcpPort: source.tcpPort,
    nextRunAt: new Date(),
  };
}
