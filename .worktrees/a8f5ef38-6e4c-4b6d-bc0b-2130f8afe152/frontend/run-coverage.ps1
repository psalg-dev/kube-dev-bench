#!/usr/bin/env pwsh
# Helper script to run Vitest with coverage

Set-Location $PSScriptRoot

Write-Host "Running Vitest with coverage enabled..." -ForegroundColor Cyan

# Run vitest with coverage
npx vitest run --coverage --reporter=verbose 2>&1 | Tee-Object -FilePath coverage-baseline.txt

$exitCode = $LASTEXITCODE

# Check if coverage was generated
if (Test-Path coverage/index.html) {
    Write-Host "`nCoverage HTML report generated at: coverage/index.html" -ForegroundColor Green
} else {
    Write-Host "`nWarning: Coverage HTML report not found" -ForegroundColor Yellow
}

if (Test-Path coverage-baseline.txt) {
    Write-Host "Coverage baseline saved to: coverage-baseline.txt" -ForegroundColor Green
}

Write-Host "`nTests completed with exit code: $exitCode" -ForegroundColor $(if ($exitCode -eq 0) { "Green" } else { "Yellow" })

exit $exitCode
