[CmdletBinding()]
param(
    [switch]$SkipDependencies
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $projectRoot '.tools'
$nodeVersion = (Get-Content -LiteralPath (Join-Path $projectRoot '.node-version') -Raw).Trim()
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$pnpmVersion = ($manifest.packageManager -split '@')[1]
$nodeFolder = "node-v$nodeVersion-win-x64"
$nodeRoot = Join-Path $toolsRoot $nodeFolder
$nodeExecutable = Join-Path $nodeRoot 'node.exe'

if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
    throw 'This setup script currently supports Windows x64. See docs/development-setup.md for other platforms.'
}

New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null

if (-not (Test-Path -LiteralPath $nodeExecutable)) {
    $archiveName = "$nodeFolder.zip"
    $archivePath = Join-Path $toolsRoot $archiveName
    $releaseUrl = "https://nodejs.org/dist/v$nodeVersion"
    $checksumText = (Invoke-WebRequest -Uri "$releaseUrl/SHASUMS256.txt").Content
    $checksumLine = $checksumText -split "`n" | Where-Object { $_.Trim().EndsWith(" $archiveName") }
    if (-not $checksumLine) { throw 'Official Node.js checksum was not found.' }
    $expectedHash = ($checksumLine.Trim() -split '\s+')[0]

    Write-Host "Downloading Node.js $nodeVersion from nodejs.org..."
    Invoke-WebRequest -Uri "$releaseUrl/$archiveName" -OutFile $archivePath
    $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if ($actualHash -ne $expectedHash) { throw 'Node.js archive checksum verification failed.' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot -Force
}

$env:PATH = "$nodeRoot;$env:PATH"
$pnpmRoot = Join-Path $toolsRoot 'pnpm'
$pnpmExecutable = Join-Path $pnpmRoot 'node_modules\.bin\pnpm.cmd'
$installedPnpm = if (Test-Path -LiteralPath $pnpmExecutable) { & $pnpmExecutable --version }

if ($installedPnpm -ne $pnpmVersion) {
    Write-Host "Installing pnpm $pnpmVersion for this project..."
    & (Join-Path $nodeRoot 'npm.cmd') install --prefix $pnpmRoot --no-audit --no-fund --package-lock=false "pnpm@$pnpmVersion"
    if ($LASTEXITCODE -ne 0) { throw 'pnpm installation failed.' }
}

& $nodeExecutable --version
& $pnpmExecutable --version

if (-not $SkipDependencies) {
    Push-Location $projectRoot
    try {
        if (Test-Path -LiteralPath 'pnpm-lock.yaml') {
            & $pnpmExecutable install --frozen-lockfile
        } else {
            & $pnpmExecutable install --no-frozen-lockfile --no-prefer-frozen-lockfile
        }
        if ($LASTEXITCODE -ne 0) { throw 'Project dependency installation failed.' }
    } finally {
        Pop-Location
    }
}

Write-Host 'Toolchain ready. Run project commands with .\scripts\pnpm.ps1'
