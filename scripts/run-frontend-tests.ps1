$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [string]$Filter,
    [string[]]$ExtraArgs
)

try {
    $rootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    $frontendPath = Join-Path $rootPath 'frontend'
    Push-Location $frontendPath

    $npmArgs = @('test', '--')
    if ($Filter) {
        $npmArgs += @('-t', $Filter)
    }
    if ($ExtraArgs) {
        $npmArgs += $ExtraArgs
    }

    npm @npmArgs
} finally {
    Pop-Location
}
