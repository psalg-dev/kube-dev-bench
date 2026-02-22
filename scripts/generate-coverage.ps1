Set-StrictMode -Version Latest

# Script to generate Go coverage and frontend coverage artifacts where possible
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $root

# Ensure coverage dir exists
$covDir = Join-Path $root '..\coverage'
New-Item -Path $covDir -ItemType Directory -Force | Out-Null

Write-Host "Running go test with coverage..."
go test ./... -covermode=atomic -coverprofile="$covDir\go-coverage" 2>&1 | Tee-Object "$covDir\go-test-run.txt"
Write-Host "Generating go coverage function summary and HTML..."
& go tool cover -func="$covDir\go-coverage" > "$covDir\go-coverage-func.txt"
& go tool cover -html="$covDir\go-coverage" -o "$covDir\go-coverage.html"

Write-Host "Attempting to run frontend vitest (may fail on non-linux hosts)..."
$frontendDir = Join-Path $root '..\frontend'
if (Test-Path $frontendDir) {
    try {
        Push-Location $frontendDir
        npm ci --no-audit --no-fund
        npm test --silent > "$covDir\frontend-vitest-output.txt" 2>&1
        if (Test-Path './coverage/lcov.info') { Copy-Item './coverage/lcov.info' "$covDir\frontend-lcov.info" -Force }
        Pop-Location
    } catch {
        Write-Warning "Frontend tests could not be run: $($_.Exception.Message)"
        Pop-Location -ErrorAction SilentlyContinue
    }
}

Write-Host "Done. Coverage artifacts are in: $covDir"
