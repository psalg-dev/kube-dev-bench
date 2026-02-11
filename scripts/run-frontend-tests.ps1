param(
    [string[]]$TestArgs = @('--verbose')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$frontendPath = Join-Path -Path $PSScriptRoot -ChildPath '..\\frontend'
Push-Location $frontendPath
try {
    npm test -- @TestArgs 2>&1 | Tee-Object -FilePath test-results.txt
} finally {
    Pop-Location
}
