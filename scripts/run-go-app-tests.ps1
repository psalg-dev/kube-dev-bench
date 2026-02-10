$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [Parameter()]
    [string]$Package = "./pkg/app/..."
)

try {
    go test -v $Package
    if ($LASTEXITCODE -ne 0) {
        throw "go test failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Error "Failed: $_"
    exit 1
}

exit 0
