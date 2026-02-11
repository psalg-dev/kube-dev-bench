$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [Parameter()]
    [string]$FrontendPath = 'frontend'
)

try {
    Set-Location $FrontendPath
    npm run typecheck
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
    Write-Output 'Frontend typecheck completed.'
} catch {
    Write-Error "Frontend typecheck failed: $_"
    exit 1
}
