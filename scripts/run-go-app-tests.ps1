$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$packagePath = if ($args.Count -ge 1) { $args[0] } else { './pkg/app/...' }
$logPath = if ($args.Count -ge 2) { $args[1] } else { './tmp/go-app-tests.log' }

try {
    $logDir = Split-Path -Path $logPath
    if ($logDir -and -not (Test-Path -Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }

    go test -v $packagePath 2>&1 | Tee-Object -FilePath $logPath
    if ($LASTEXITCODE -ne 0) {
        throw "go test failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Error "Failed: $_"
    exit 1
}

exit 0
