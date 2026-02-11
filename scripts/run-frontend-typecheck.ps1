$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $frontendPath = Join-Path $PSScriptRoot '..' 'frontend'
    Set-Location -Path $frontendPath
    npm run typecheck
} catch {
    Write-Error "Typecheck failed: $_"
    exit 1
}
