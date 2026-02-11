param(
    [Parameter()]
    [string]$PackagePath = './pkg/app/...',

    [Parameter()]
    [string]$OutputPath = './test-results.txt'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    go test -v $PackagePath 2>&1 | Out-File -FilePath $OutputPath -Encoding UTF8
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "go test failed. See $OutputPath"
    }

    Write-Output "Tests passed. Output saved to $OutputPath"
} catch {
    Write-Error "go test failed: $($_.Exception.Message)"
    exit 1
}
