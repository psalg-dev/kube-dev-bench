param(
    [Parameter()]
    [string]$RunPattern
)

$ErrorActionPreference = 'Stop'

$arguments = @('./pkg/app')
if ($RunPattern) {
    $arguments += @('-run', $RunPattern)
}
$arguments += '-v'

& go test @arguments
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
