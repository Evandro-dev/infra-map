import { describe, it, expect } from 'vitest';
import {
  monitorConfigSchema,
  type MonitorObservation,
  type WindowsComputerReport,
} from '@infra/contracts';
import { compareExpectedPrinters, computerHealth, deviceHealth } from './monitoring.domain.js';

const printer = {
  id: 'printer',
  name: 'RH',
  printServer: 'SRV-PRINT',
  printShare: 'RH',
  approvedDriver: 'Epson',
};
const report: WindowsComputerReport = {
  target: 'PC-RH',
  spooler: 'Running',
  osCaption: 'Windows',
  uptimeHours: 3,
  freeMemoryPercent: 40,
  disks: [{ name: 'C:', freePercent: 50 }],
  printers: [],
  printersAvailable: true,
  warnings: [],
};
const queue = {
  Name: String.raw`\\SRV-PRINT\RH`,
  DriverName: 'Epson',
  ComputerName: null,
  ShareName: null,
  PortName: null,
};
const now = new Date('2026-10-25T22:00:00Z');
const reading = (
  source: MonitorObservation['source'],
  status: MonitorObservation['status'],
  age = 0,
): MonitorObservation => ({
  id: source,
  deviceId: 'pc',
  source,
  status,
  summary: 'Leitura',
  checkedAt: new Date(now.getTime() - age * 1000).toISOString(),
  data: {},
});
describe('comparação de computador e impressora', () => {
  it('identifica a fila UNC sem depender de maiúsculas e compara o driver', () => {
    expect(compareExpectedPrinters([printer], [queue], true)[0].status).toBe('OK');
    expect(
      compareExpectedPrinters(
        [printer],
        [{ ...queue, Name: 'RH', ComputerName: 'srv-print', ShareName: 'RH', DriverName: 'Outro' }],
        true,
      )[0],
    ).toMatchObject({ status: 'WARNING', observedDriver: 'Outro' });
  });
  it('não aceita uma fila homônima de outro servidor e não presume ausência no perfil', () => {
    const result = compareExpectedPrinters(
      [printer],
      [{ ...queue, Name: 'RH', ComputerName: 'OTHER' }],
      true,
    )[0];
    expect(result.status).toBe('UNKNOWN');
    expect(result.summary).toContain('perfil do usuário');
    expect(compareExpectedPrinters([printer], [], false)[0].status).toBe('UNKNOWN');
    expect(
      compareExpectedPrinters([printer], [{ ...queue, DriverName: null }], true)[0],
    ).toMatchObject({ status: 'UNKNOWN', observedDriver: null });
  });
  it('prioriza spooler parado e disco crítico; leitura parcial não fica verde', () => {
    expect(computerHealth({ ...report, spooler: 'Stopped' }, []).status).toBe('CRITICAL');
    expect(computerHealth({ ...report, disks: [{ name: 'C:', freePercent: 4 }] }, []).status).toBe(
      'CRITICAL',
    );
    expect(computerHealth({ ...report, warnings: ['Sem permissões'] }, []).status).toBe('WARNING');
  });
});
describe('estado agregado sem inventar disponibilidade', () => {
  const config = monitorConfigSchema.parse({ enabled: true, useIsl: true, useWindows: true });
  it('ISL online com Windows sem permissão é parcial, e nunca totalmente OK', () => {
    expect(
      deviceHealth('pc', config, [reading('ISL', 'OK'), reading('WINDOWS', 'UNAVAILABLE')], now)
        .state,
    ).toBe('PARTIAL');
    expect(
      deviceHealth(
        'pc',
        config,
        [reading('ISL', 'UNAVAILABLE'), reading('WINDOWS', 'UNAVAILABLE')],
        now,
      ).state,
    ).toBe('UNKNOWN');
  });
  it('envelhece leituras e não usa falhas antigas como estado atual', () => {
    expect(deviceHealth('pc', config, [reading('ISL', 'CRITICAL', 181)], now).state).toBe('STALE');
    expect(
      deviceHealth('pc', config, [reading('ISL', 'CRITICAL', 181), reading('WINDOWS', 'OK')], now)
        .state,
    ).toBe('PARTIAL');
  });
  it('preserva criticidade e diferencia monitoramento desativado', () => {
    expect(
      deviceHealth('pc', config, [reading('ISL', 'CRITICAL'), reading('WINDOWS', 'OK')], now).state,
    ).toBe('CRITICAL');
    expect(
      deviceHealth('pc', { ...config, enabled: false }, [reading('ISL', 'OK')], now).state,
    ).toBe('DISABLED');
  });
  it('exige fontes explícitas e porta TCP conhecida', () => {
    expect(monitorConfigSchema.safeParse({ enabled: true }).success).toBe(false);
    expect(monitorConfigSchema.safeParse({ useTcp: true }).success).toBe(false);
    expect(
      monitorConfigSchema.safeParse({ useTcp: true, tcpPort: 9100, password: 'secret' }).success,
    ).toBe(false);
  });
  it('apresenta a comparação mais recente por impressora sem duplicar relações de Windows e ISL', () => {
    const old = {
      printerId: 'printer',
      printerName: 'RH',
      status: 'WARNING' as const,
      summary: 'Antigo',
      expectedDriver: 'Epson',
      observedDriver: 'Outro',
    };
    const windows = { ...reading('WINDOWS', 'WARNING', 20), data: { relations: [old] } };
    const diagnostic = {
      ...reading('ISL_DIAGNOSTIC', 'OK'),
      data: { relations: [{ ...old, status: 'OK', summary: 'Atual' }] },
    };
    expect(deviceHealth('pc', config, [diagnostic, windows], now).relations).toEqual([
      { ...old, status: 'OK', summary: 'Atual' },
    ]);
  });
});
