param(
    [string[]]$Packages = @('./pkg/app/...'),
    [string]$Run,
    [string]$CoverProfile
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$arguments = @('test', '-v')
if ($CoverProfile) {
    $arguments += @('-coverprofile', $CoverProfile)
}
if ($Run) {
    $arguments += @('-run', $Run)
}
$arguments += $Packages

& go @arguments
