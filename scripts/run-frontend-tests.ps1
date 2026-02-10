$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [string[]]$TestArgs
)

try {
    $frontendPath = Join-Path $PSScriptRoot '..' 'frontend'
    Set-Location -Path $frontendPath

    npm test -- --verbose @TestArgs

    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "npm test failed with exit code $exitCode."
    }
} catch {
    Write-Error "Failed to run frontend tests: $_"
    exit 1
}
