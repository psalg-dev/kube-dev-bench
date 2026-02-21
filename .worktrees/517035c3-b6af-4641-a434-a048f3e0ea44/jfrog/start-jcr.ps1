# One-command JCR setup - Starts JCR and runs bootstrap automatically
# Usage: .\start-jcr.ps1 [-Password "YourPassword"]

param(
    [string]$Password = "Admin123!"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Starting JFrog Container Registry ===" -ForegroundColor Cyan
Write-Host ""

# Start docker compose
Write-Host "Starting JCR container..." -ForegroundColor Yellow
docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error starting docker compose" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Container started" -ForegroundColor Green
Write-Host ""

# Run bootstrap
Write-Host "Running automated bootstrap..." -ForegroundColor Yellow
Write-Host ""

& "$PSScriptRoot\bootstrap-jcr.ps1" -AdminPassword $Password

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Bootstrap failed. You can:" -ForegroundColor Yellow
    Write-Host "  1. Complete setup manually at http://localhost:8081" -ForegroundColor White
    Write-Host "  2. Run bootstrap again: .\bootstrap-jcr.ps1" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "=== JCR Ready! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Quick test:" -ForegroundColor Cyan
Write-Host "  docker login localhost:8081" -ForegroundColor White
Write-Host "  # Username: admin" -ForegroundColor Gray
Write-Host "  # Password: $Password" -ForegroundColor Gray
Write-Host ""
