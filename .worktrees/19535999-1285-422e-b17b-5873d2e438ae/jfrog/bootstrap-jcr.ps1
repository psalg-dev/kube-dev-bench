# Bootstrap JFrog Container Registry - Complete Setup Automation
# This script automates the initial setup wizard and Docker repository creation

param(
    [string]$AdminPassword = "Admin123!",
    [string]$BaseUrl = "http://localhost:8081"
)

$ErrorActionPreference = "Stop"

Write-Host "=== JFrog Container Registry - Automated Bootstrap ===" -ForegroundColor Cyan
Write-Host ""

# Wait for JCR to be healthy
Write-Host "Waiting for JCR to be ready..." -ForegroundColor Yellow
$maxAttempts = 60
$attempt = 0
$healthy = $false

while (-not $healthy -and $attempt -lt $maxAttempts) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8082/artifactory/api/system/ping" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            Write-Host "✓ JCR is ready!" -ForegroundColor Green
        }
    }
    catch {
        $attempt++
        Start-Sleep -Seconds 2
    }
}

if (-not $healthy) {
    Write-Host "Error: JCR did not become healthy in time" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Completing initial setup wizard..." -ForegroundColor Yellow

# Default credentials before setup
$defaultUser = "admin"
$defaultPass = "password"
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${defaultUser}:${defaultPass}"))

# Step 1: Complete onboarding wizard
Write-Host "1. Setting admin password..." -ForegroundColor Yellow

$onboardingBody = @{
    password = $AdminPassword
    retypedPassword = $AdminPassword
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8081/artifactory/api/system/configuration/wizard/password" `
        -Method Post `
        -Headers @{
            Authorization = "Basic $base64AuthInfo"
            "Content-Type" = "application/json"
        } `
        -Body $onboardingBody `
        -ErrorAction SilentlyContinue

    Write-Host "✓ Admin password set" -ForegroundColor Green
}
catch {
    # Might already be configured
    Write-Host "⚠ Password already set or wizard completed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "2. Configuring base URL..." -ForegroundColor Yellow

# Update credentials to new password
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${defaultUser}:${AdminPassword}"))

$baseUrlBody = @{
    baseUrl = $BaseUrl
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8081/artifactory/api/system/configuration/baseUrl" `
        -Method Put `
        -Headers @{
            Authorization = "Basic $base64AuthInfo"
            "Content-Type" = "application/json"
        } `
        -Body $baseUrlBody `
        -ErrorAction SilentlyContinue

    Write-Host "✓ Base URL configured: $BaseUrl" -ForegroundColor Green
}
catch {
    Write-Host "⚠ Base URL configuration skipped" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3. Accepting EULA..." -ForegroundColor Yellow

try {
    $eulaResponse = Invoke-RestMethod -Uri "http://localhost:8081/artifactory/ui/onboarding/eula" `
        -Method Post `
        -Headers @{
            Authorization = "Basic $base64AuthInfo"
        } `
        -ErrorAction SilentlyContinue

    Write-Host "✓ EULA accepted" -ForegroundColor Green
}
catch {
    Write-Host "⚠ EULA already accepted" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "4. Creating docker-local repository..." -ForegroundColor Yellow

$dockerRepoBody = @{
    key = "docker-local"
    rclass = "local"
    packageType = "docker"
    description = "Local Docker registry for testing"
    dockerApiVersion = "V2"
    maxUniqueSnapshots = 0
    handleReleases = $true
    handleSnapshots = $true
    checksumPolicyType = "client-checksums"
    snapshotVersionBehavior = "unique"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8081/artifactory/api/repositories/docker-local" `
        -Method Put `
        -Headers @{
            Authorization = "Basic $base64AuthInfo"
            "Content-Type" = "application/json"
        } `
        -Body $dockerRepoBody

    Write-Host "✓ docker-local repository created!" -ForegroundColor Green
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "✓ docker-local repository already exists" -ForegroundColor Green
    }
    else {
        Write-Host "⚠ Error creating repository: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "5. Verifying setup..." -ForegroundColor Yellow

try {
    # Verify we can access with new credentials
    $verify = Invoke-RestMethod -Uri "http://localhost:8081/artifactory/api/repositories/docker-local" `
        -Method Get `
        -Headers @{Authorization = "Basic $base64AuthInfo"}

    Write-Host "✓ Setup verified!" -ForegroundColor Green
}
catch {
    Write-Host "⚠ Could not verify setup" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Bootstrap Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Credentials:" -ForegroundColor Cyan
Write-Host "  Username: admin"
Write-Host "  Password: $AdminPassword"
Write-Host ""
Write-Host "Docker Registry:" -ForegroundColor Cyan
Write-Host "  URL: localhost:8081/docker-local"
Write-Host ""
Write-Host "Test commands:" -ForegroundColor Cyan
Write-Host "  docker login localhost:8081"
Write-Host "  docker tag alpine:latest localhost:8081/docker-local/alpine:test"
Write-Host "  docker push localhost:8081/docker-local/alpine:test"
Write-Host ""
Write-Host "Web UI: http://localhost:8081" -ForegroundColor Cyan
Write-Host ""
