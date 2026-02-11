$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [Parameter()]
    [string]$WorktreePath = (Join-Path $PSScriptRoot '..' '.agent-worktrees' 'agent-cad4e1e728c2c9703f98aa46c04d2e42-1770804479916')
)

Set-Location $WorktreePath
go test -v ./pkg/app/...
