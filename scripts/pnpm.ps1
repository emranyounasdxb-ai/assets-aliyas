$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeVersion = (Get-Content -LiteralPath (Join-Path $projectRoot '.node-version') -Raw).Trim()
$nodeRoot = Join-Path $projectRoot ".tools\node-v$nodeVersion-win-x64"
$pnpmExecutable = Join-Path $projectRoot '.tools\pnpm\node_modules\.bin\pnpm.cmd'

if (-not (Test-Path -LiteralPath (Join-Path $nodeRoot 'node.exe')) -or -not (Test-Path -LiteralPath $pnpmExecutable)) {
    throw 'Run .\scripts\setup.ps1 first to install the project toolchain.'
}

$env:PATH = "$nodeRoot;$env:PATH"
Push-Location $projectRoot
try {
    & $pnpmExecutable @args
    $commandExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $commandExitCode
