param(
    [string]$ProfilePath = "coverage_profiles/app_coverage",
    [string]$FuncPath = "coverage_profiles/app_coverage_func.txt"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$profileFullPath = Join-Path $repoRoot $ProfilePath
$funcFullPath = Join-Path $repoRoot $FuncPath
$profileDir = Split-Path $profileFullPath -Parent

if (-not (Test-Path $profileDir)) {
    New-Item -Path $profileDir -ItemType Directory -Force | Out-Null
}

& go test ./pkg/app/... -coverprofile=$profileFullPath
& go tool cover -func=$profileFullPath | Tee-Object -FilePath $funcFullPath
