$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [switch]$WithCoverage,
    [string]$CoverProfile = 'go-cover.out'
)

if ($WithCoverage) {
    go test '-coverprofile=' + $CoverProfile ./pkg/app/...
    go tool cover -func $CoverProfile
    return
}

go test -v ./pkg/app/...
