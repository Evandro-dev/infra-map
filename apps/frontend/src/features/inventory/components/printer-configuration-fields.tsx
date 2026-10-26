'use client';
import {
  printerConfigSchema,
  type PrinterConfiguration,
  type CatalogQueue,
} from '@infra/contracts';
import { CatalogField } from './catalog-field';

export function PrinterConfigurationFields({
  value,
  onChange,
  disabled,
}: {
  value: PrinterConfiguration;
  onChange: (change: PrinterConfiguration) => void;
  disabled?: boolean;
}) {
  const server = value.printServer ?? '';
  const applyQueue = (queue: CatalogQueue) => {
    const change: PrinterConfiguration = {
      printServer: queue.server,
      printQueue: queue.name,
      printShare: queue.shareName,
      approvedDriver: queue.driverName,
      printPort: queue.portName,
      printProtocol: queue.protocol,
      printPortNumber: queue.portNumber,
    };
    if (
      queue.hostAddress &&
      printerConfigSchema.shape.ipAddress.safeParse(queue.hostAddress).success
    )
      change.ipAddress = queue.hostAddress;
    onChange(change);
  };
  return (
    <>
      <CatalogField
        field="printServer"
        kind="PRINTER"
        label="Servidor de impressão"
        value={server}
        onChange={(printServer) =>
          onChange({
            printServer,
            printQueue: null,
            printShare: null,
            approvedDriver: null,
            printPort: null,
            printProtocol: null,
            printPortNumber: null,
          })
        }
        disabled={disabled}
        help="Trocar o servidor limpa os dados dependentes de fila, driver e porta no rascunho."
      />
      <CatalogField
        field="printQueue"
        kind="PRINTER"
        server={server}
        label="Fila no servidor"
        value={value.printQueue ?? ''}
        onChange={(printQueue) => onChange({ printQueue })}
        onSelect={(option) => {
          if (option.queue) applyQueue(option.queue);
        }}
        disabled={disabled}
        help="Selecionar uma fila preenche os dados conhecidos no rascunho. Confira antes de salvar. Digitar manualmente também é permitido."
      />
      <CatalogField
        field="printShare"
        kind="PRINTER"
        server={server}
        label="Nome da fila compartilhada"
        value={value.printShare ?? ''}
        onChange={(printShare) => onChange({ printShare })}
        disabled={disabled}
      />
      <CatalogField
        field="approvedDriver"
        kind="PRINTER"
        server={server}
        label="Driver homologado"
        value={value.approvedDriver ?? ''}
        onChange={(approvedDriver) => onChange({ approvedDriver })}
        disabled={disabled}
        help="Driver encontrado não comprova homologação do pacote. Confirme o padrão aprovado pela TI."
      />
      <CatalogField
        field="printPort"
        kind="PRINTER"
        server={server}
        label="Nome da porta de impressão"
        value={value.printPort ?? ''}
        onChange={(printPort) =>
          onChange({ printPort, printProtocol: null, printPortNumber: null })
        }
        onSelect={(option) => {
          const port = option.port;
          if (port) {
            const change: PrinterConfiguration = {
              printPort: port.name,
              printProtocol: port.protocol,
              printPortNumber: port.portNumber,
            };
            if (
              port.hostAddress &&
              printerConfigSchema.shape.ipAddress.safeParse(port.hostAddress).success
            )
              change.ipAddress = port.hostAddress;
            onChange(change);
          }
        }}
        disabled={disabled}
      />
      <CatalogField
        field="printProtocol"
        kind="PRINTER"
        server={server}
        label="Protocolo da porta"
        value={value.printProtocol ?? ''}
        onChange={(printProtocol) => onChange({ printProtocol })}
        disabled={disabled}
      />
      <label className="form-row">
        <span className="muted">Porta TCP (número)</span>
        <input
          className="field"
          type="number"
          min={1}
          max={65535}
          value={value.printPortNumber ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              printPortNumber: event.target.value === '' ? null : Number(event.target.value),
            })
          }
          placeholder="Somente se conhecida"
        />
      </label>
    </>
  );
}
