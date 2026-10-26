import { printerImportSchema, printSnapshotSchema, type PrintSnapshot } from '@infra/contracts';

/** Documentação fornece referência; não é uma consulta atual ao servidor. */
export function preparePrintReferences(input: unknown): PrintSnapshot[] {
  const source = printerImportSchema.parse(input);
  const byServer = new Map<string, PrintSnapshot>();
  for (const printer of source.impressoras) {
    const key = printer.servidor_impressao.toLowerCase();
    let snapshot = byServer.get(key);
    if (!snapshot) {
      snapshot = {
        server: printer.servidor_impressao,
        source: 'REFERENCE',
        collectedAt: new Date().toISOString(),
        referenceDate: source.data_do_cadastro,
        queues: [],
        drivers: [],
        ports: [],
        warnings: [
          'Referência documental; disponibilidade, portas e configuração atuais precisam de conferência.',
        ],
      };
      byServer.set(key, snapshot);
    }
    const portName = printer.porta_no_servidor ?? null;
    snapshot.queues.push({
      name: printer.nome_da_fila_no_servidor_observado ?? printer.nome_compartilhamento,
      shareName: printer.nome_compartilhamento,
      driverName: printer.driver_no_servidor,
      portName,
      hostAddress: printer.ip,
      protocol: null,
      portNumber: null,
      shared: true,
      location: printer.setor_ou_local,
    });
    if (!snapshot.drivers.some((driver) => driver.name === printer.driver_no_servidor))
      snapshot.drivers.push({
        name: printer.driver_no_servidor,
        manufacturer: null,
        environment: null,
      });
    if (portName && !snapshot.ports.some((port) => port.name === portName))
      snapshot.ports.push({
        name: portName,
        hostAddress: printer.ip,
        protocol: null,
        portNumber: null,
      });
  }
  return [...byServer.values()].map((snapshot) => printSnapshotSchema.parse(snapshot));
}
