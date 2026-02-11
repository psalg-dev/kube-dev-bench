$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
    [Parameter(Mandatory = $true)]
    [string]$TestPath,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

try {
    $argsList = @('--prefix', 'frontend', 'test', '--', $TestPath)
    if ($ExtraArgs) {
        $argsList += $ExtraArgs
    }

    npm @argsList
} catch {
    Write-Error "Failed to run frontend tests: $_"
    exit 1
}
