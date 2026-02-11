$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $frontendPath = Join-Path $PSScriptRoot '..' 'frontend'
    Set-Location -Path $frontendPath
    npm run typecheck

    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "npm run typecheck failed with exit code $exitCode."
    }
} catch {
    Write-Error "Failed to run frontend typecheck: $_"
    exit 1
}
