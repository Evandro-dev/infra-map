[CmdletBinding()]
param(
  [ValidateSet('disabled','hosted','self-hosted')][string]$Mode = 'disabled',
  [string]$ServerUrl = ''
)
$ErrorActionPreference='Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $root 'apps\backend\.env'
if (-not (Test-Path -LiteralPath $envFile)) {throw 'Arquivo apps/backend/.env não encontrado. Execute a instalação original antes.'}
if ($Mode -eq 'self-hosted' -and $ServerUrl -and $ServerUrl -notmatch '^https://') {throw 'O endereço ISL próprio deve usar HTTPS.'}
$raw=[System.IO.File]::ReadAllText($envFile)
if ($raw -match '(?m)^ISL_MODE=') {Write-Host 'ISL_MODE já existe; altere manualmente em apps/backend/.env para preservar as configurações existentes.' -ForegroundColor Yellow}
else {$raw += "`r`nISL_MODE=$Mode`r`n"}
$vars=@{ISL_SERVER_URL=$ServerUrl; ISL_API_USERNAME=''; ISL_API_PASSWORD=''; ISL_LIGHT_EXE=''; ISL_REMOTE_EXEC_ENABLED='false'}
foreach($name in $vars.Keys){
 if ($raw -notmatch "(?m)^$name=") {$raw += "$name=$($vars[$name])`r`n"}
}
if ($raw -notmatch '(?m)^SUPPORT_OPERATOR_TOKEN=') {
 $b=New-Object byte[] 32
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try {$rng.GetBytes($b)} finally {$rng.Dispose()}
 $secret=([BitConverter]::ToString($b)).Replace('-','').ToLowerInvariant()
 $raw += "SUPPORT_OPERATOR_TOKEN=$secret`r`n"
 Write-Host 'Chave de suporte criada no apps/backend/.env. Não compartilhe essa chave.' -ForegroundColor Green
}
[System.IO.File]::WriteAllText($envFile,$raw,(New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Configuração de integração preparada sem substituir senhas existentes.' -ForegroundColor Green
Write-Host 'Amanhã: preencha ISL_MODE, ISL_SERVER_URL (se próprio), ISL_API_USERNAME, ISL_API_PASSWORD e ISL_LIGHT_EXE.'
Write-Host 'O módulo de execução remota permanecerá desativado até aprovação e testes.'
