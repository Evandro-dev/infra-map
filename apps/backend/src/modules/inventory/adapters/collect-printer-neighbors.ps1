$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = [Console]::OutputEncoding

# Faz um único ping ICMP por IP fornecido e lê somente a entrada ARP daquele IP.
# Não enumera interfaces, sub-redes ou faixas de endereço.
$targets = @($env:INFRA_MAP_NEIGHBOR_IPS | ConvertFrom-Json)
$results = @()
foreach ($target in $targets) {
  $reachable = $false
  try {
    $ping = New-Object System.Net.NetworkInformation.Ping
    $reply = $ping.Send([string]$target, 1500)
    $reachable = $reply.Status -eq [System.Net.NetworkInformation.IPStatus]::Success
    $ping.Dispose()
  } catch { $reachable = $false }

  $neighbors = @()
  if ($reachable) {
    try {
      $neighbors = @(Get-NetNeighbor -IPAddress ([string]$target) -AddressFamily IPv4 -ErrorAction Stop | Where-Object {
        $_.LinkLayerAddress -match '^(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}$' -and
        $_.State -notin @('Incomplete', 'Unreachable', 'Unknown')
      })
    } catch { $neighbors = @() }
  }
  $macs = @($neighbors | ForEach-Object { $_.LinkLayerAddress.ToUpper().Replace('-', ':') } | Select-Object -Unique)
  $macAddress = $null
  $interfaceAlias = $null
  $state = $null
  if ($macs.Count -eq 1) {
    $compact = $macs[0].Replace(':', '')
    $firstByte = [Convert]::ToInt32($compact.Substring(0, 2), 16)
    if (($firstByte -band 1) -eq 0 -and $compact -ne '000000000000' -and $compact -ne 'FFFFFFFFFFFF') {
      $macAddress = $macs[0]
      $interfaceAlias = $neighbors[0].InterfaceAlias
      $state = [string]$neighbors[0].State
    }
  }
  $results += [pscustomobject]@{
    ipAddress = [string]$target
    reachable = $reachable
    macAddress = $macAddress
    interfaceAlias = $interfaceAlias
    neighborState = $state
  }
}
ConvertTo-Json -InputObject @($results) -Depth 4 -Compress
