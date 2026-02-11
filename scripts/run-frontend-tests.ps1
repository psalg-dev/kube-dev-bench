$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

try {
    $projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
    $frontendPath = Join-Path $projectRoot 'frontend'
    Set-Location $frontendPath
    if ($Args.Count -gt 0) {
        npm test -- --run @Args
    } else {
        npm test -- --run
    }
} catch {
    Write-Error "Failed to run frontend tests: $_"
    exit 1
}
