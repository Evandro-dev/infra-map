import { describe, expect, it } from 'vitest';
import { cloneDeviceData, cloneMonitorData, type DeviceCloneInput } from './device-clone.js';

const source: DeviceCloneInput = {
  name: 'IMPRESSORA-CAIXA-01',
  kind: 'PRINTER',
  model: 'L3250',
  manufacturer: 'Epson',
  operatingSystem: null,
  printServer: 'PRINT-SRV',
  printShare: 'CAIXA-01',
  approvedDriver: 'Epson Universal',
  printQueue: 'CAIXA-01',
  printPort: 'IP_192.0.2.10',
  printProtocol: 'RAW',
  printPortNumber: 9100,
  monitoring: {
    intervalSeconds: 120,
    timeoutSeconds: 6,
    useIsl: false,
    useWindows: false,
    usePrintServer: true,
    useTcp: true,
    tcpPort: 9100,
  },
};

describe('clonagem de equipamentos', () => {
  it('mantém a configuração base e limpa os identificadores físicos', () => {
    expect(cloneDeviceData(source)).toMatchObject({
      name: 'IMPRESSORA-CAIXA-01 (cópia)',
      kind: 'PRINTER',
      model: 'L3250',
      manufacturer: 'Epson',
      printServer: 'PRINT-SRV',
      printShare: 'CAIXA-01',
      printPortNumber: 9100,
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
    });
  });

  it('copia parâmetros de monitoramento, mas deixa o clone desativado', () => {
    expect(cloneMonitorData(source.monitoring, 'device-copy')).toMatchObject({
      deviceId: 'device-copy',
      enabled: false,
      intervalSeconds: 120,
      timeoutSeconds: 6,
      usePrintServer: true,
      useTcp: true,
      tcpPort: 9100,
    });
    expect(cloneMonitorData(null, 'device-copy')).toBeNull();
  });
});
