import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { preparePrinterImport } from './printer-import.model.js';

const source = () =>
  JSON.parse(
    readFileSync(
      new URL(
        '../../../../../docs/references/cadastro_impressoras_economart.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
describe('cadastro técnico fornecido', () => {
  it('importa rede e driver confirmados, preserva pendências e não inventa status atual nem patrimônio', () => {
    const rows = preparePrinterImport(source());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      ipAddress: '192.168.27.202',
      printShare: 'ECO-POA-RHU-P01',
      approvedDriver: 'EPSON WF-M5899 Series',
      status: 'UNKNOWN',
    });
    expect(rows[1].macAddress).toBeNull();
    expect(rows[1]).not.toHaveProperty('serialNumber');
    expect(rows[1].notes).toContain('Pendências:');
    expect(rows[1].notes).not.toContain('PXA3CU2');
  });
  it('rejeita fila duplicada e divergência no caminho de rede', () => {
    const input = source();
    input.impressoras.push(input.impressoras[0]);
    expect(() => preparePrinterImport(input)).toThrow(/duplicadas/);
    const mismatch = source();
    mismatch.impressoras[0].caminho_compartilhado = '\\\\outro\\fila';
    expect(() => preparePrinterImport(mismatch)).toThrow(/inconsistente/);
  });
});
