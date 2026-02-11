$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $frontendPath = Join-Path $PSScriptRoot '..' 'frontend'
    Set-Location -Path $frontendPath
    $logPath = Join-Path $PSScriptRoot '..' 'frontend-typecheck.log'
    if (Test-Path $logPath) {
        Remove-Item -Path $logPath -Force
    }
    npm run typecheck 2>&1 | Tee-Object -FilePath $logPath
    if ($LASTEXITCODE -ne 0) {
        throw "Typecheck failed. See $logPath"
    }
} catch {
    Write-Error "Typecheck failed: $_"
    exit 1
}
