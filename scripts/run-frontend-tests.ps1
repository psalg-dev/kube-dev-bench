$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [string[]]$TestArgs = @('--verbose')
)

$frontendPath = Join-Path $PSScriptRoot '..' 'frontend'
Push-Location $frontendPath
try {
    npm test -- @TestArgs 2>&1 | Tee-Object -FilePath test-results.txt
} finally {
    Pop-Location
}
