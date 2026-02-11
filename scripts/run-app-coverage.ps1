$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    go test '-coverprofile=go-cover.out' ./pkg/app/...
    go tool cover -func go-cover.out
} catch {
    Write-Error "Failed: $_"
    exit 1
}
