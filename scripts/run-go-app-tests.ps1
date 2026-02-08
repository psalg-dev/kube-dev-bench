param(
    [Parameter()]
    [string]$PackagePath = './pkg/app',

    [Parameter()]
    [string]$RunPattern
)

$ErrorActionPreference = 'Stop'

$arguments = @($PackagePath)
if ($RunPattern) {
    $arguments += @('-run', $RunPattern)
}
$arguments += '-v'

& go test @arguments
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
