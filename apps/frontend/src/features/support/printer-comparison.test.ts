import { describe, expect, it } from 'vitest';
import { comparePrinters } from './printer-comparison';
import type { ReferencePrinter } from './types';

const expected = [
  {
    name: 'Epson RH',
    printServer: 'SRV-SKY-PRT-01',
    printShare: 'ECO-POA-RHU-P01',
    approvedDriver: 'EPSON WF-M5899 Series',
  },
] as ReferencePrinter[];
describe('comparação de impressoras', () => {
  it('reconhece UNC sem diferenciar maiúsculas e compara o driver', () => {
    expect(
      comparePrinters(
        JSON.stringify({
          Name: '\\\\srv-sky-prt-01\\eco-poa-rhu-p01',
          DriverName: 'Microsoft IPP Class Driver',
        }),
        expected,
      )[0],
    ).toContain('difere');
  });
  it('não confunde filas de mesmo nome em servidores diferentes', () => {
    expect(
      comparePrinters(
        JSON.stringify({
          Name: '\\\\other-server\\ECO-POA-RHU-P01',
          DriverName: 'EPSON WF-M5899 Series',
        }),
        expected,
      )[0],
    ).toContain('não encontrada');
  });
  it('não trata relatório vazio como falha comprovada do perfil do usuário', () => {
    expect(comparePrinters('[]', expected)[0]).toContain('contexto SYSTEM');
  });
});
