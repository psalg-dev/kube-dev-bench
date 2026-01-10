# Setup Docker repository in JFrog Container Registry
# This script configures JCR after initial setup

Write-Host "=== JFrog Container Registry - Docker Setup ===" -ForegroundColor Cyan
Write-Host ""

# Prompt for credentials
Write-Host "Enter your JCR credentials (set during initial login)" -ForegroundColor Yellow
$Username = Read-Host "Username [admin]"
if ([string]::IsNullOrWhiteSpace($Username)) {
    $Username = "admin"
}

$SecurePassword = Read-Host "Password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
$Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host ""

# Create credentials
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
$headers = @{
    Authorization = "Basic $base64AuthInfo"
    "Content-Type" = "application/json"
}

Write-Host "Creating docker-local repository..." -ForegroundColor Yellow

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
        -Headers $headers `
        -Body $dockerRepoBody

    Write-Host "✓ docker-local repository created!" -ForegroundColor Green
    Write-Host ""
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "Repository may already exist, checking..." -ForegroundColor Yellow
    } else {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Verify repository
Write-Host "Verifying Docker repository..." -ForegroundColor Yellow
try {
    $verify = Invoke-RestMethod -Uri "http://localhost:8081/artifactory/api/repositories/docker-local" `
        -Method Get `
        -Headers @{Authorization = "Basic $base64AuthInfo"}

    Write-Host "✓ Repository verified and ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== Docker Registry Configuration ===" -ForegroundColor Cyan
    Write-Host "Registry URL: localhost:8081/docker-local" -ForegroundColor White
    Write-Host "Repository Key: docker-local" -ForegroundColor White
    Write-Host "Package Type: Docker (v2)" -ForegroundColor White
    Write-Host ""
    Write-Host "=== Test Your Setup ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Login to registry:" -ForegroundColor Yellow
    Write-Host "   docker login localhost:8081" -ForegroundColor White
    Write-Host "   Username: $Username"
    Write-Host "   Password: (your JCR password)"
    Write-Host ""
    Write-Host "2. Tag an image:" -ForegroundColor Yellow
    Write-Host "   docker tag alpine:latest localhost:8081/docker-local/alpine:test" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Push the image:" -ForegroundColor Yellow
    Write-Host "   docker push localhost:8081/docker-local/alpine:test" -ForegroundColor White
    Write-Host ""
    Write-Host "4. List images via API:" -ForegroundColor Yellow
    Write-Host "   curl -u ${Username}:PASSWORD http://localhost:8081/artifactory/api/docker/docker-local/v2/_catalog" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host "Error verifying repository: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Setup complete!" -ForegroundColor Green
