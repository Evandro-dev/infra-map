import type { SupportAction } from '@infra/contracts';

export const actionList = [
  {
    id: 'spooler_status',
    name: 'Conferir Spooler',
    risk: 'READ',
    detail: 'Estado e inicialização do serviço.',
  },
  {
    id: 'printer_inventory',
    name: 'Impressoras e drivers',
    risk: 'READ',
    detail: 'Filas, driver, porta e servidor visíveis à conta SYSTEM.',
  },
  {
    id: 'printer_jobs',
    name: 'Trabalhos de impressão',
    risk: 'READ',
    detail: 'Quantidade de trabalhos por fila, sem conteúdo dos documentos.',
  },
  {
    id: 'restart_spooler',
    name: 'Reiniciar Spooler',
    risk: 'CHANGE',
    detail:
      'Interrompe brevemente a impressão deste computador; pode afetar trabalhos em andamento.',
  },
  {
    id: 'clear_spooler',
    name: 'Limpar Spooler',
    risk: 'CHANGE',
    detail:
      'Exclui TODOS os trabalhos pendentes do Spooler padrão deste computador. Exige confirmação de perda dos trabalhos.',
  },
  {
    id: 'reinstall_printer',
    name: 'Reinstalar impressora',
    risk: 'ASSISTED',
    detail: 'Procedimento no ISL Light, no perfil do usuário, com a fila corporativa confirmada.',
  },
  {
    id: 'reinstall_driver',
    name: 'Reinstalar driver',
    risk: 'ASSISTED',
    detail: 'Procedimento no ISL Light; requer pacote homologado e avaliação das outras filas.',
  },
] as const;

// Comandos fixos. Nenhum texto recebido do navegador é interpolado no script.
export function actionCommand(action: SupportAction): string[] {
  const commands: Record<SupportAction, string> = {
    spooler_status:
      'Get-Service -Name Spooler | Select-Object Name,@{Name="Status";Expression={$_.Status.ToString()}},@{Name="StartType";Expression={$_.StartType.ToString()}} | ConvertTo-Json -Compress',
    printer_inventory:
      'ConvertTo-Json -InputObject @(Get-Printer | Select-Object Name,DriverName,PortName,ComputerName,Shared,ShareName,PrinterStatus) -Compress',
    printer_jobs: `@(Get-Printer | ForEach-Object {
      $p=$_;
      try { $n=@(Get-PrintJob -PrinterName $p.Name -ErrorAction Stop).Count; [pscustomobject]@{Printer=$p.Name;PendingJobs=$n;QueryError=$false} }
      catch { [pscustomobject]@{Printer=$p.Name;PendingJobs=$null;QueryError=$true} }
    }) | ConvertTo-Json -Compress`,
    restart_spooler:
      'Restart-Service -Name Spooler -ErrorAction Stop; Get-Service Spooler | Select-Object Name,Status | ConvertTo-Json -Compress',
    clear_spooler: `
      $defaultSpool=Join-Path $env:windir 'System32\\spool\\PRINTERS';
      $configuredSpool=(Get-ItemProperty -LiteralPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers' -Name DefaultSpoolDirectory -ErrorAction SilentlyContinue).DefaultSpoolDirectory;
      if ($configuredSpool -and [Environment]::ExpandEnvironmentVariables($configuredSpool).TrimEnd('\\') -ine $defaultSpool.TrimEnd('\\')) { throw 'Diretório de Spooler personalizado: use atendimento assistido.' };
      $custom=@(Get-ChildItem -LiteralPath 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers' | Where-Object { (Get-ItemProperty -LiteralPath $_.PSPath -Name SpoolDirectory -ErrorAction SilentlyContinue).SpoolDirectory });
      if ($custom.Count -gt 0) { throw 'Fila com diretório personalizado: use atendimento assistido.' };
      try {
        Stop-Service -Name Spooler -ErrorAction Stop;
        $files=@(Get-ChildItem -LiteralPath $defaultSpool -File -ErrorAction Stop | Where-Object { $_.Extension -in '.SPL','.SHD' });
        $files | Remove-Item -Force -ErrorAction Stop;
      } finally { Start-Service -Name Spooler -ErrorAction Stop };
      [pscustomobject]@{RemovedSpoolFiles=$files.Count;Status=(Get-Service Spooler).Status.ToString()} | ConvertTo-Json -Compress
    `,
  };
  const encoded = Buffer.from(
    `$ErrorActionPreference='Stop'; ${commands[action]}`,
    'utf16le',
  ).toString('base64');
  return [
    'powershell.exe',
    '--arg_e',
    String.raw`%windir_system_native%\WindowsPowerShell\v1.0\powershell.exe`,
    '-NoProfile',
    '-NonInteractive',
    '-EncodedCommand',
    encoded,
  ];
}
