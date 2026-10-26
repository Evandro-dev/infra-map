import { describe, expect, it } from 'vitest';
import { actionCommand } from './support.actions.js';
import { supportActionSchema as actionSchema } from '@infra/contracts';

describe('catálogo fechado de manutenção', () => {
  it('limpeza usa caminho fixo, filtra arquivos de spool e tenta recuperar o serviço', () => {
    const script = Buffer.from(actionCommand('clear_spooler').at(-1)!, 'base64').toString(
      'utf16le',
    );
    expect(script).toContain('System32\\spool\\PRINTERS');
    expect(script).toContain("$_.Extension -in '.SPL','.SHD'");
    expect(script).toContain('finally { Start-Service -Name Spooler');
    expect(script).not.toContain('-Recurse');
  });
  it('gera diagnóstico somente de leitura por comando codificado', () => {
    const args = actionCommand('spooler_status');
    expect(args[0]).toBe('powershell.exe');
    expect(args).toContain('-EncodedCommand');
    const script = Buffer.from(args.at(-1)!, 'base64').toString('utf16le');
    expect(script).toContain('Get-Service -Name Spooler');
    expect(script).not.toContain('Restart-Service');
  });
  it('rejeita comandos arbitrários no contrato', () => {
    expect(actionSchema.safeParse('Remove-Item C:\\').success).toBe(false);
    expect(actionSchema.safeParse('reinstall_driver').success).toBe(false);
  });
});
