$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
$server = $env:INFRA_MAP_PRINT_SERVER
try { Import-Module PrintManagement -ErrorAction Stop }
catch { [pscustomobject]@{errorCode='MODULE_UNAVAILABLE'} | ConvertTo-Json -Compress; exit 2 }

$session = $null
$secret = $null
$credential = $null
$request = $null
$exitCode = 0
try {
  # Recebe credenciais apenas por stdin. Não usar senha na linha de comando ou no ambiente.
  $inputText = [Console]::In.ReadToEnd()
  $request = $inputText | ConvertFrom-Json
  $target = @{ ComputerName = $server }
  if ($request.credentials) {
    $secret = ConvertTo-SecureString -String $request.credentials.password -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential($request.credentials.username, $secret)
    $request.credentials.password = $null
    $inputText = $null
    $options = New-CimSessionOption -Protocol Dcom
    $session = New-CimSession -ComputerName $server -Credential $credential -SessionOption $options -OperationTimeoutSec 10 -ErrorAction Stop
    $target = @{ CimSession = $session }
  }

  # Consultas de leitura a um único destino escolhido pelo operador.
  $printers = @(Get-Printer @target -ErrorAction Stop)
  $warnings = @()
  $serverIdentity = $null
  try {
    $computer = Get-CimInstance @target -ClassName Win32_ComputerSystem -OperationTimeoutSec 5 -ErrorAction Stop
    $bios = Get-CimInstance @target -ClassName Win32_BIOS -OperationTimeoutSec 5 -ErrorAction Stop
    $serverOs = Get-CimInstance @target -ClassName Win32_OperatingSystem -OperationTimeoutSec 5 -ErrorAction Stop
    $networkAdapters = @(Get-CimInstance @target -ClassName Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True' -OperationTimeoutSec 5 -ErrorAction Stop | ForEach-Object {
      [pscustomobject]@{
        name = $_.Description
        macAddress = $_.MACAddress
        ipv4Addresses = @($_.IPAddress | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' })
        subnetMasks = @($_.IPSubnet | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' })
        defaultGateways = @($_.DefaultIPGateway | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' })
        dnsServers = @($_.DNSServerSearchOrder | Where-Object { $_ })
      }
    })
    $primaryAdapters = @($networkAdapters | Where-Object { $_.defaultGateways.Count -gt 0 -and $_.ipv4Addresses.Count -gt 0 })
    $primaryIp = $null
    $primaryMac = $null
    if ($primaryAdapters.Count -eq 1 -and $primaryAdapters[0].ipv4Addresses.Count -eq 1) {
      $primaryIp = $primaryAdapters[0].ipv4Addresses[0]
      $primaryMac = $primaryAdapters[0].macAddress
    }
    $serverIdentity = [pscustomobject]@{
      hostname = $computer.DNSHostName
      manufacturer = $computer.Manufacturer
      model = $computer.Model
      serialNumber = $bios.SerialNumber
      operatingSystem = $serverOs.Caption
      ipAddress = $primaryIp
      macAddress = $primaryMac
      networkAdapters = $networkAdapters
    }
  } catch { $warnings += 'Identidade do servidor ou configuração de rede indisponível; as filas continuam válidas.' }
  $ports = @()
  $drivers = @()
  try {
    $ports = @(Get-PrinterPort @target -ErrorAction Stop | ForEach-Object {
      $protocol = $null
      if ($_.Protocol -eq 1) { $protocol = 'RAW' }
      elseif ($_.Protocol -eq 2) { $protocol = 'LPR' }
      elseif ($_.Protocol -is [string] -and $_.Protocol) { $protocol = $_.Protocol }
      $portNumber = $null
      if ($_.PortNumber -ge 1 -and $_.PortNumber -le 65535) { $portNumber = [int]$_.PortNumber }
      [pscustomobject]@{ name = $_.Name; hostAddress = $_.PrinterHostAddress; protocol = $protocol; portNumber = $portNumber }
    })
  } catch { $warnings += 'Não foi possível consultar as portas. Os demais dados foram mantidos.' }
  try {
    $drivers = @(Get-PrinterDriver @target -ErrorAction Stop | ForEach-Object {
      [pscustomobject]@{ name = $_.Name; manufacturer = $_.Manufacturer; environment = $_.PrinterEnvironment }
    })
  } catch { $warnings += 'Não foi possível consultar os drivers. Os nomes informados nas filas continuam disponíveis.' }
  $queues = @($printers | ForEach-Object {
    $printer = $_
    $port = @($ports | Where-Object { $_.name -eq $printer.PortName })
    $hostAddress = $null
    $protocol = $null
    $portNumber = $null
    if ($port.Count -eq 1) { $hostAddress = $port[0].hostAddress; $protocol = $port[0].protocol; $portNumber = $port[0].portNumber }
    [pscustomobject]@{
      name = $printer.Name; shareName = $printer.ShareName; driverName = $printer.DriverName;
      portName = $printer.PortName; shared = [bool]$printer.Shared; location = $printer.Location; status = [string]$printer.PrinterStatus;
      hostAddress = $hostAddress; protocol = $protocol; portNumber = $portNumber
    }
  })
  [pscustomobject]@{
    server = $server; source = 'WINDOWS'; collectedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ');
    serverIdentity = $serverIdentity; queues = $queues; drivers = $drivers; ports = $ports; warnings = $warnings
  } | ConvertTo-Json -Depth 8 -Compress
} catch {
  $errorCode = 'SERVER_QUERY_FAILED'
  if ($_.CategoryInfo.Category -eq 'PermissionDenied') { $errorCode = 'WINDOWS_ACCESS_DENIED' }
  [pscustomobject]@{errorCode=$errorCode} | ConvertTo-Json -Compress
  $exitCode = 3
} finally {
  if ($session) { Remove-CimSession -CimSession $session -ErrorAction SilentlyContinue }
  if ($secret) { $secret.Dispose() }
  $credential = $null
  $request = $null
  $inputText = $null
}
exit $exitCode
