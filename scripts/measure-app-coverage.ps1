param(
    [Parameter()]
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

Set-Location $RepoRoot

go test ./pkg/app/... -coverprofile=coverage_profiles/app_coverage
go tool cover -func coverage_profiles/app_coverage | Select-String -Pattern 'total:'
