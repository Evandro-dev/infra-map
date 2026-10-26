import type { ReferencePrinter } from './types';

// A consulta executa como SYSTEM. Ausência não prova falha no perfil interativo do usuário.
export function comparePrinters(result: string, expected: ReferencePrinter[]): string[] {
  try {
    const parsed: unknown = JSON.parse(result.replace(/^\uFEFF/, ''));
    const list = Array.isArray(parsed) ? parsed : parsed === null ? [] : [parsed];
    if (!expected.length) return ['Associe primeiro as impressoras esperadas a este computador.'];
    const rows = list.filter(
      (row): row is Record<string, unknown> =>
        typeof row === 'object' && row !== null && !Array.isArray(row),
    );
    if (list.length && !rows.length) return ['Formato de relatório desconhecido. Confira no ISL.'];
    return expected.map((printer) => {
      const share = printer.printShare?.toLowerCase();
      const server = printer.printServer?.replace(/^\\+/, '').toLowerCase();
      if (!share || !server)
        return `${printer.name}: cadastre servidor e fila compartilhada para comparar.`;
      const unc = `\\\\${server}\\${share}`;
      const found = rows.find((row) => {
        const name = String(row.Name ?? '').toLowerCase();
        const rowServer = String(row.ComputerName ?? '')
          .replace(/^\\+/, '')
          .toLowerCase();
        return (
          name === unc ||
          (rowServer === server &&
            (name === share || String(row.ShareName ?? '').toLowerCase() === share))
        );
      });
      if (!found)
        return `${printer.name}: fila ${unc} não encontrada no contexto SYSTEM. Confira também o perfil do usuário no ISL Light.`;
      const driver = String(found.DriverName ?? '');
      if (printer.approvedDriver && driver.toLowerCase() !== printer.approvedDriver.toLowerCase())
        return `${printer.name}: driver encontrado (${driver}) difere do cadastrado (${printer.approvedDriver}).`;
      return `${printer.name}: fila e servidor correspondem ao cadastro${printer.approvedDriver ? '; driver compatível' : ''}. Isso não comprova impressão física.`;
    });
  } catch {
    return ['O retorno não é um JSON de impressoras reconhecido. Confira o relatório manualmente.'];
  }
}
