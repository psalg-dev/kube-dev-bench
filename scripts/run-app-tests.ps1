$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [string]$PackagePath = './pkg/app/...'
)

& go test -v $PackagePath
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
