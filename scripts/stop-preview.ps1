$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot '.tools\preview.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Output 'No preview started by preview-local.ps1 was recorded.'; exit 0 }
$previewProcessId = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
$previewProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $previewProcessId"
if (-not $previewProcess) { Write-Output 'The recorded preview process has already stopped.'; exit 0 }
$expectedLauncher = Join-Path $PSScriptRoot 'pnpm.ps1'
if ($previewProcess.CommandLine.IndexOf($expectedLauncher, [StringComparison]::OrdinalIgnoreCase) -lt 0 -or $previewProcess.CommandLine -notmatch '\bstart\b') {
    throw 'The recorded process does not match this project preview. It was left running.'
}
& taskkill.exe /PID $previewProcessId /T /F
if ($LASTEXITCODE -ne 0) { throw 'Could not stop the recorded preview process.' }
Write-Output 'The Aliyas Assets preview has stopped. Database and file storage are preserved.'
