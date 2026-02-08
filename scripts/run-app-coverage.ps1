param(
    [Parameter()]
    [string]$ProfilePath = 'coverage_profiles/app_mcp_wrappers.cov'
)

$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force (Split-Path $ProfilePath) | Out-Null

go test ./pkg/app -coverprofile=$ProfilePath

$legacyPath = Join-Path (Split-Path $ProfilePath) ([System.IO.Path]::GetFileNameWithoutExtension($ProfilePath))
if ((Test-Path $legacyPath) -and -not (Test-Path $ProfilePath)) {
    Move-Item -Force $legacyPath $ProfilePath
}

go tool cover -func $ProfilePath | Select-String -Pattern 'total:'
