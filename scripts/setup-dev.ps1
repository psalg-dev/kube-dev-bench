param()

# setup-dev.ps1
# Checks for required runtimes and tools for local development and provides guidance.

$requirements = @(
    @{ Name = 'go'; Check = { Get-Command go -ErrorAction SilentlyContinue } ; Install = 'https://go.dev/dl/' },
    @{ Name = 'node'; Check = { Get-Command node -ErrorAction SilentlyContinue } ; Install = 'https://nodejs.org/en/download/' },
    @{ Name = 'npm'; Check = { Get-Command npm -ErrorAction SilentlyContinue } ; Install = 'https://nodejs.org/en/download/' },
    @{ Name = 'wails'; Check = { Get-Command wails -ErrorAction SilentlyContinue } ; Install = 'https://wails.io/' },
    @{ Name = 'docker'; Check = { Get-Command docker -ErrorAction SilentlyContinue } ; Install = 'https://docs.docker.com/get-docker/' }
)

Write-Host "Checking system for required development tools..." -ForegroundColor Cyan
$missing = @()
foreach ($r in $requirements) {
    $present = & $r.Check
    if ($null -eq $present) {
        Write-Host "  - $($r.Name) : MISSING" -ForegroundColor Yellow
        $missing += $r
    } else {
        Write-Host "  - $($r.Name) : present (`$($present.Source)`)") -ForegroundColor Green
    }
}

if ($missing.Count -eq 0) {
    Write-Host "\nAll required tools appear to be installed." -ForegroundColor Green
    Write-Host "Recommended next steps:" -ForegroundColor Cyan
    Write-Host "  1. Install Go modules: `go mod download`" -ForegroundColor Gray
    Write-Host "  2. Install frontend dependencies: `cd frontend; npm install`" -ForegroundColor Gray
    Write-Host "  3. Run tests: `go test ./...` and `cd frontend; npm test`" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "\nMissing tools detected. Please install the following:" -ForegroundColor Red
    foreach ($m in $missing) {
        Write-Host "  - $($m.Name) : $($m.Install)" -ForegroundColor Yellow
    }
    exit 2
}
