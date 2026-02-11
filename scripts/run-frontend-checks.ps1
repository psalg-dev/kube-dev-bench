param(
    [string]$FrontendPath = (Join-Path -Path $PSScriptRoot -ChildPath '../frontend')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $resolvedFrontendPath = (Resolve-Path -Path $FrontendPath).Path -replace '\\', '/'
    if (-not (Test-Path -Path $resolvedFrontendPath)) {
        throw "Frontend path not found: $resolvedFrontendPath"
    }

    Write-Host 'Running frontend typecheck...'
    npm --prefix $resolvedFrontendPath run typecheck

    Write-Host 'Running frontend tests...'
    npm --prefix $resolvedFrontendPath test
} catch {
    Write-Error "Frontend checks failed: $_"
    exit 1
}
