param(
    [Parameter(Mandatory = $true)]
    [string]$Pattern,

    [Parameter()]
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

Set-Location $RepoRoot

go test ./pkg/app -run $Pattern -v
