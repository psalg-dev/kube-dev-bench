$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [Parameter()]
    [string]$WorktreePath = (Join-Path $PSScriptRoot '..' '.agent-worktrees' 'agent-cad4e1e728c2c9703f98aa46c04d2e42-1770804479916'),

    [Parameter()]
    [string]$OutputPath
)

Set-Location $WorktreePath

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    go test -v ./pkg/app/...
} else {
    go test -v ./pkg/app/... 2>&1 | Tee-Object -FilePath $OutputPath
}
