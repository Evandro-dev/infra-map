import { describe, expect, it } from 'vitest';
import { isVirtualOrFaxQueue, matchObservedPrinter } from './topology-discovery.service.js';

const serverPrinter = {
  elementId: 'printer-node',
  id: 'printer-id',
  name: 'ECO-POA-RHU-P01',
  printServer: 'srv-sky-prt-01',
  printQueue: 'RH-EPSON-M5899-SKY',
  printShare: 'ECO-POA-RHU-P01',
};

describe('correspondência de filas observadas', () => {
  it('separa filas virtuais e Fax das filas candidatas a equipamento físico', () => {
    expect(
      isVirtualOrFaxQueue({
        Name: 'Microsoft Print to PDF',
        DriverName: 'Microsoft Print to PDF',
        PortName: 'PORTPROMPT:',
        ComputerName: 'PC-01',
        ShareName: null,
      }),
    ).toBe(true);
    expect(
      isVirtualOrFaxQueue({
        Name: 'RH-EPSON-M5899-WSD',
        DriverName: 'Microsoft IPP Class Driver',
        PortName: 'WSD-1',
        ComputerName: 'PC-01',
        ShareName: null,
      }),
    ).toBe(false);
  });

  it('vincula uma fila compartilhada somente com servidor e nome exatos', () => {
    expect(
      matchObservedPrinter(
        {
          Name: '\\\\srv-sky-prt-01\\ECO-POA-RHU-P01',
          DriverName: 'EPSON WF-M5899 Series',
          PortName: 'IP_192.168.27.202',
          ComputerName: 'ECO-POA-TIF-01',
          ShareName: 'ECO-POA-RHU-P01',
        },
        [serverPrinter],
      ),
    ).toEqual({ status: 'MATCHED', printer: serverPrinter });
  });

  it('não presume servidor a partir de um nome de fila compartilhada isolado', () => {
    expect(
      matchObservedPrinter(
        {
          Name: 'RH-EPSON-M5899-SKY',
          DriverName: 'EPSON WF-M5899 Series',
          PortName: 'IP_192.168.27.202',
          ComputerName: null,
          ShareName: 'ECO-POA-RHU-P01',
        },
        [serverPrinter],
      ),
    ).toEqual({ status: 'UNMATCHED' });
  });

  it('reconhece fila local por nome exato e deixa ambiguidades sem vínculo', () => {
    const local = {
      elementId: 'local-node',
      id: 'local-id',
      name: 'ECO-POA-FCA-P01',
      printServer: null,
      printQueue: 'ECO-POA-FCA-P01 (WF-M5899 Series)',
      printShare: null,
    };
    const observed = {
      Name: 'ECO-POA-FCA-P01 (WF-M5899 Series)',
      DriverName: 'EPSON WF-M5899 Series',
      PortName: 'WSD-1',
      ComputerName: 'ECO-POA-TIF-01',
      ShareName: null,
    };
    expect(matchObservedPrinter(observed, [local])).toEqual({
      status: 'MATCHED',
      printer: local,
    });
    expect(matchObservedPrinter(observed, [local, local])).toEqual({
      status: 'AMBIGUOUS',
    });
  });
});
