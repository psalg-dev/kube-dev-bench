param(
    [Parameter()]
    [string]$WorkingDirectory = 'frontend',

    [Parameter()]
    [string[]]$NpmArgs = @('--', '--run', '--silent')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
    $targetPath = Join-Path $repoRoot $WorkingDirectory
    Set-Location $targetPath
    npm test @NpmArgs
} catch {
    Write-Error "Frontend tests failed: $($_.Exception.Message)"
    exit 1
}
