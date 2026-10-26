#requires -Version 5.1
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $root
try {
  & npm.cmd install --no-fund
  if($LASTEXITCODE -ne 0){throw 'Falha no npm install'}
  & node.exe scripts/prepare-dev.mjs
  if($LASTEXITCODE -ne 0){throw 'Falha na preparacao do PostgreSQL/Prisma'}
  Write-Host 'Dependencias e banco prontos. Use: npm run dev' -ForegroundColor Green
} finally {Pop-Location}
