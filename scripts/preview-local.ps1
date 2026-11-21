[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$Port = 3200,
    [switch]$OpenBrowser
)
$ErrorActionPreference = 'Stop'
$env:NEXT_TELEMETRY_DISABLED = '1'
$projectRoot = Split-Path -Parent $PSScriptRoot
$url = "http://127.0.0.1:$Port"
Push-Location $projectRoot
try {
    $existing = $null
    try { $existing = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2 } catch {}
    if ($existing.application -eq 'aliyas-assets') {
        Write-Output "Aliyas Assets is already running: $url"
        if ($OpenBrowser) { Start-Process $url }
        exit 0
    }
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $Port is used by another application. Choose a different port."
    }
    & "$PSScriptRoot\pnpm.ps1" db:start *> '.tools\backend-start.log'
    if ($LASTEXITCODE -ne 0) { throw 'The local database could not start. See .tools/backend-start.log.' }
    & "$PSScriptRoot\pnpm.ps1" exec node --env-file=.env.local scripts/migrate.mjs *> '.tools\migration.log'
    if ($LASTEXITCODE -ne 0) { throw 'The database migration could not finish.' }
    & "$PSScriptRoot\pnpm.ps1" exec node --env-file=.env.local scripts/bootstrap-demo.mjs
    if ($LASTEXITCODE -ne 0) { throw 'The local preview account could not be prepared.' }
    & "$PSScriptRoot\pnpm.ps1" build
    if ($LASTEXITCODE -ne 0) { throw 'The application build did not pass.' }
    $shellPath = (Get-Command pwsh).Source
    $launcher = Join-Path $PSScriptRoot 'pnpm.ps1'
    $process = Start-Process -FilePath $shellPath -ArgumentList @('-NoLogo', '-NoProfile', '-File', "`"$launcher`"", 'start', '--port', $Port) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot '.tools\preview.log') -RedirectStandardError (Join-Path $projectRoot '.tools\preview-error.log') -PassThru
    $process.Id | Set-Content -LiteralPath '.tools\preview.pid'
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2; if ($health.application -eq 'aliyas-assets') { $ready = $true; break } } catch {}
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'The preview did not become ready. See .tools/preview-error.log.' }
    Write-Output "Aliyas Assets is ready: $url"
    if ($OpenBrowser) { Start-Process $url }
} finally {
    Pop-Location
}
