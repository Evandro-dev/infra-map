import { describe, expect, it } from 'vitest';
import { printServerSchema, samePrintServer } from './inventory-catalog.ts';

describe('print server input', () => {
  it('normalizes a Windows UNC server prefix to the host name', () => {
    expect(printServerSchema.parse('\\\\srv-sky-prt-01')).toBe('srv-sky-prt-01');
  });

  it('rejects share paths and invalid host names', () => {
    expect(() => printServerSchema.parse('\\\\srv-sky-prt-01\\queue')).toThrow(
      'sem caminho de compartilhamento',
    );
    expect(() => printServerSchema.parse('\\\\srv;command')).toThrow(
      'sem caminho de compartilhamento',
    );
  });

  it('matches a saved server credential with a UNC server name case-insensitively', () => {
    expect(samePrintServer('\\\\SRV-SKY-PRT-01', 'srv-sky-prt-01')).toBe(true);
  });

  it('does not match invalid names or different servers', () => {
    expect(samePrintServer('\\\\srv-sky-prt-01', 'srv-other-01')).toBe(false);
    expect(samePrintServer('', 'srv-sky-prt-01')).toBe(false);
    expect(samePrintServer('\\\\srv-sky-prt-01\\queue', 'srv-sky-prt-01')).toBe(false);
  });
});
