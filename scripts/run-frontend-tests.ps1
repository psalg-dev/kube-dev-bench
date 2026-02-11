$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [Parameter()]
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

try {
    $frontendPath = Join-Path $ProjectRoot 'frontend'
    Set-Location -Path $frontendPath
    npm test -- --verbose
} catch {
    Write-Error "Frontend tests failed: $_"
    exit 1
}
