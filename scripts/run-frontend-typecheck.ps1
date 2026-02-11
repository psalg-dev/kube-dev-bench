$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Join-Path $PSScriptRoot '..'
Set-Location -Path (Join-Path $projectRoot 'frontend')

npm run typecheck
