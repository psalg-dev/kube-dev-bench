param(
    [Parameter(Position = 0)]
    [string]$Pattern,

    [string[]]$AdditionalArgs = @(),
    [switch]$VerboseOutput,
    [string]$ProjectRoot,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    if (-not $ProjectRoot) {
        $ProjectRoot = Split-Path -Parent $PSScriptRoot
    }
    $frontendPath = Join-Path $ProjectRoot 'frontend'
    if (-not $OutputPath) {
        $OutputPath = Join-Path $ProjectRoot 'frontend-test-results.txt'
    }
    $vitestModule = Join-Path $frontendPath 'node_modules' 'vitest' 'vitest.mjs'
    if (-not (Test-Path $vitestModule)) {
        throw "Vitest module not found at $vitestModule"
    }

    $argsList = @($vitestModule, 'run', '-c', 'vitest.config.ts')
    if ($Pattern) {
        $argsList += @('-t', $Pattern)
    }
    if ($AdditionalArgs.Count -gt 0) {
        $argsList += $AdditionalArgs
    }
    if ($VerboseOutput.IsPresent) {
        $argsList += '--verbose'
    }

    New-Item -ItemType File -Path $OutputPath -Force | Out-Null
    Push-Location $frontendPath
    try {
        & node.exe @argsList 2>&1 | Tee-Object -FilePath $OutputPath
    } finally {
        Pop-Location
    }
} catch {
    Write-Error "Failed to run frontend tests: $_"
    exit 1
}
