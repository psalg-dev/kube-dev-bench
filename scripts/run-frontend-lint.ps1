param(
    [string]$WorkingDir = 'frontend'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    Push-Location -Path $WorkingDir
    npm run lint
} catch {
    Write-Error "Frontend lint failed: $_"
    exit 1
} finally {
    Pop-Location
}
