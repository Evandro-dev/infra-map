import { printerImportSchema } from '@infra/contracts';
import { AppError } from '../../shared/errors.js';

export function preparePrinterImport(input: unknown) {
  const source = printerImportSchema.parse(input);
  const seen = new Set<string>();
  return source.impressoras.map((printer) => {
    const path = `\\\\${printer.servidor_impressao}\\${printer.nome_compartilhamento}`;
    const key = path.toLocaleLowerCase('en-US');
    if (printer.caminho_compartilhado.toLowerCase() !== key)
      throw new AppError(
        400,
        `Caminho de rede inconsistente para ${printer.nome_amigavel_sugerido}.`,
      );
    if (seen.has(key)) throw new AppError(400, 'O arquivo contém filas de impressão duplicadas.');
    seen.add(key);
    return {
      name: printer.nome_amigavel_sugerido,
      kind: 'PRINTER',
      manufacturer: printer.fabricante,
      model: printer.modelo,
      ipAddress: printer.ip,
      macAddress: printer.mac_address,
      printServer: printer.servidor_impressao,
      printShare: printer.nome_compartilhamento,
      approvedDriver: printer.driver_no_servidor,
      notes: [
        `Fonte: cadastro técnico fornecido de ${source.empresa_unidade}, em ${source.data_do_cadastro}.`,
        `Local informado: ${printer.setor_ou_local}.`,
        `Fila corporativa: ${path}.`,
        `Teste relatado na fonte: ${printer.status_e_validacao.teste_de_impressao}`,
        `Pendências: ${printer.campos_a_confirmar.join('; ')}.`,
        'Status atual não consultado. Configurações alternativas WSD/LPR observadas não substituem a fila corporativa. Consulte a documentação de referência para histórico e acessórios.',
      ].join('\n'),
    };
  });
}
