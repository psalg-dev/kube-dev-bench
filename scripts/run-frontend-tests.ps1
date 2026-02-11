param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $npmArgs = @('--prefix', 'frontend', 'test', '--', '--reporter', 'verbose')
    if ($ExtraArgs) {
        $npmArgs += $ExtraArgs
    }
    & npm @npmArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} catch {
    Write-Error "Failed to run frontend tests: $_"
    exit 1
}
