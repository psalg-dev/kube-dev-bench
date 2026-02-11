$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [Parameter(Mandatory)]
    [string]$Path
)

try {
    Test-Path -Path $Path
} catch {
    Write-Error "Failed: $_"
    exit 1
}
