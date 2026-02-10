Param(
    [string[]]$Packages = @('./...'),
    [string]$Run = '',
    [int]$Count = 1,
    [string]$CoverProfile = '',
    [string[]]$ExtraArgs = @()
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$flags = @()
if ($Run) {
    $flags += @('-run', $Run)
}
if ($Count -ge 0) {
    $flags += "-count=$Count"
}
if ($CoverProfile) {
    $flags += "-coverprofile=$CoverProfile"
}

& go test @flags @ExtraArgs @Packages
