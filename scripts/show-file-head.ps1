param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter()]
    [int]$Lines = 60
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -Path $Path)) {
    throw "File not found: $Path"
}

Get-Content -Path $Path -TotalCount $Lines
