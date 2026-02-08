$ErrorActionPreference = "Stop"

param(
    [string[]]$ExtraArgs = @()
)

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$argsList = @("test", "./pkg/app/...") + $ExtraArgs
& go @argsList
