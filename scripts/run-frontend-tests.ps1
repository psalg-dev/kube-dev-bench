param(
    [Parameter()]
    [string[]]$Args
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Push-Location -Path frontend
try {
    if ($Args -and $Args.Length -gt 0) {
        npm test -- $Args
    } else {
        npm test -- --verbose
    }
} finally {
    Pop-Location
}
