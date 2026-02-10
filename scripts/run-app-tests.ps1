$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [string]$CoverProfile = 'go-cover.out'
)

try {
    go test -v ./pkg/app/...
    go test -coverprofile $CoverProfile ./pkg/app/...
} catch {
    Write-Error "Tests failed: $_"
    exit 1
}
