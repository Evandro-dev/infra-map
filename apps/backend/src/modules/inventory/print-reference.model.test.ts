import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { preparePrintReferences } from './print-reference.model.js';

describe('referência documental de impressão', () => {
  it('mantém a data e as pendências de protocolo/porta TCP', () => {
    const input: unknown = JSON.parse(
      readFileSync(
        new URL(
          '../../../../../docs/references/cadastro_impressoras_economart.json',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const [reference] = preparePrintReferences(input);
    expect(reference.source).toBe('REFERENCE');
    expect(reference.referenceDate).toBe('2026-10-23');
    expect(reference.queues).toHaveLength(2);
    expect(reference.queues[0]).toMatchObject({
      name: 'RH-EPSON-M5899-SKY',
      shareName: 'ECO-POA-RHU-P01',
      portName: '192.168.27.202',
      protocol: null,
      portNumber: null,
    });
  });
  it('recusa documentação sem as informações mínimas de rede', () => {
    expect(() =>
      preparePrintReferences({
        empresa_unidade: 'Teste',
        data_do_cadastro: '2026-10-23',
        impressoras: [{ nome_amigavel_sugerido: 'Fila sem rede' }],
      }),
    ).toThrow();
  });
});
