type ElementKind = 'AREA' | 'DEVICE';
export type DeviceKind =
  'COMPUTER' | 'PRINTER' | 'SCALE' | 'CAMERA' | 'SERVER' | 'SWITCH' | 'UPS' | 'PDV' | 'OTHER';
export interface Device {
  id: string;
  name: string;
  kind: DeviceKind;
  model: string | null;
  printServer: string | null;
  printShare: string | null;
  approvedDriver: string | null;
  printQueue: string | null;
  printPort: string | null;
  printProtocol: string | null;
  printPortNumber: number | null;
  ipAddress: string | null;
  assetTag: string | null;
  manufacturer: string | null;
  serialNumber: string | null;
  macAddress: string | null;
  hostname: string | null;
  operatingSystem: string | null;
  assignedUser: string | null;
  notes: string | null;
  status: string;
}
export interface MapElement {
  id: string;
  mapId?: string;
  parentId: string | null;
  deviceId: string | null;
  kind: ElementKind;
  name: string;
  iconKey: string | null;
  xMeters: number;
  yMeters: number;
  widthMeters: number;
  heightMeters: number;
  level: number;
  orderIndex?: number;
  hidden?: boolean;
  locked?: boolean;
  device?: Device | null;
}
export interface MapRecord {
  id: string;
  name: string;
  widthMeters: number;
  heightMeters: number;
  hasTerritory?: boolean;
  originXMeters?: number;
  originYMeters?: number;
  elements: MapElement[];
}
export const DEFAULT_ICONS: Record<DeviceKind, string> = {
  COMPUTER: 'monitor',
  PRINTER: 'printer',
  SCALE: 'scale',
  CAMERA: 'cctv',
  SERVER: 'server',
  SWITCH: 'network',
  UPS: 'battery',
  PDV: 'shopping-cart',
  OTHER: 'box',
};
export const DEVICE_LABELS: Record<DeviceKind, string> = {
  COMPUTER: 'Computador',
  PRINTER: 'Impressora',
  SCALE: 'Balança',
  CAMERA: 'Câmera',
  SERVER: 'Servidor',
  SWITCH: 'Switch',
  UPS: 'Nobreak',
  PDV: 'PDV',
  OTHER: 'Outro',
};
export function suggestedSectorIcon(name: string) {
  const term = name.trim().toLocaleLowerCase('pt-BR');
  if (/\bti\b|informática|tecnologia/.test(term)) return 'monitor-cog';
  if (/\brh\b|recursos humanos/.test(term)) return 'users';
  if (/açougue|acougue/.test(term)) return 'beef';
  if (/estoque|depósito|deposito/.test(term)) return 'boxes';
  if (/financeiro/.test(term)) return 'wallet';
  if (/caixa|pdv/.test(term)) return 'shopping-cart';
  if (/servidor|rack/.test(term)) return 'server';
  return 'door-open';
}

export interface MapConnection {
  id: string;
  mapId: string;
  sourceElementId: string;
  targetElementId: string;
  kind?: 'NETWORK' | 'PRINTING';
  printerAssignmentId?: string | null;
  createdAt?: string;
}
