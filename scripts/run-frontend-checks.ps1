$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [switch]$SkipTypecheck,
    [switch]$SkipTests
)

Set-Location -Path 'frontend'

if (-not $SkipTypecheck) {
    npm run typecheck
}

if (-not $SkipTests) {
    npm test -- --verbose
}
