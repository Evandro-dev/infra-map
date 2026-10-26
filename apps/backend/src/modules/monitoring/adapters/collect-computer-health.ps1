$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = [Console]::OutputEncoding
$target = $env:INFRA_MAP_COMPUTER
$session = $null
try {
  $options = New-CimSessionOption -Protocol Dcom
  $session = New-CimSession -ComputerName $target -SessionOption $options -OperationTimeoutSec 5 -ErrorAction Stop
  $warnings = @()
  $os = Get-CimInstance -CimSession $session -ClassName Win32_OperatingSystem -OperationTimeoutSec 5 -ErrorAction Stop
  $spooler = $null
  try { $spooler = (Get-CimInstance -CimSession $session -ClassName Win32_Service -Filter "Name='Spooler'" -OperationTimeoutSec 5 -ErrorAction Stop).State }
  catch { $warnings += 'Estado do Spooler indisponível.' }
  $disks = @()
  try {
    $disks = @(Get-CimInstance -CimSession $session -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -OperationTimeoutSec 5 -ErrorAction Stop | Where-Object { $_.Size -gt 0 } | ForEach-Object {
      [pscustomobject]@{name=$_.DeviceID;freePercent=[Math]::Round(100*$_.FreeSpace/$_.Size,2)}
    })
  } catch { $warnings += 'Métricas de disco indisponíveis.' }
  $printers = @()
  $printersAvailable = $false
  try {
    Import-Module PrintManagement -ErrorAction Stop
    $printers = @(Get-Printer -CimSession $session -ErrorAction Stop | Select-Object Name,DriverName,PortName,ComputerName,ShareName)
    $printersAvailable = $true
  } catch { $warnings += 'Filas visíveis à coleta remota indisponíveis; conferir o perfil do usuário no ISL Light.' }
  $memory = $null
  if ($os.TotalVisibleMemorySize -gt 0) { $memory = [Math]::Round(100*$os.FreePhysicalMemory/$os.TotalVisibleMemorySize,2) }
  [pscustomobject]@{
    target=$target;spooler=$spooler;osCaption=$os.Caption;uptimeHours=[Math]::Round(((Get-Date)-$os.LastBootUpTime).TotalHours,2);freeMemoryPercent=$memory;
    disks=$disks;printers=$printers;printersAvailable=$printersAvailable;warnings=$warnings
  } | ConvertTo-Json -Depth 8 -Compress
} finally { if ($session) { Remove-CimSession -CimSession $session -ErrorAction SilentlyContinue } }
