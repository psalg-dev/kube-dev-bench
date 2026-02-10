[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Package,

    [Parameter()]
    [string]$RunRegex
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$arguments = @('test', $Package)
if ($RunRegex) {
    $arguments += @('-run', $RunRegex)
}

& go @arguments
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
