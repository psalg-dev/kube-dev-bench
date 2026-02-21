# Setup Docker repository in Artifactory
# Run this after completing initial setup in the UI

Write-Host "Setting up Docker repository in Artifactory..." -ForegroundColor Green
Write-Host ""

# Prompt for credentials
$Username = Read-Host "Enter admin username [admin]"
if ([string]::IsNullOrWhiteSpace($Username)) {
    $Username = "admin"
}

$SecurePassword = Read-Host "Enter admin password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
$Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host ""

# Create credentials
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))

# Create Docker local repository
Write-Host "Creating docker-local repository..." -ForegroundColor Yellow

$body = @{
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
        -Headers @{Authorization=("Basic {0}" -f $base64AuthInfo); "Content-Type"="application/json"} `
        -Body $body

    Write-Host "✓ docker-local repository created successfully!" -ForegroundColor Green
    Write-Host ""

    # Verify repository
    Write-Host "Verifying Docker repository..." -ForegroundColor Yellow
    $verify = Invoke-RestMethod -Uri "http://localhost:8081/artifactory/api/repositories/docker-local" `
        -Method Get `
        -Headers @{Authorization=("Basic {0}" -f $base64AuthInfo)}

    Write-Host "✓ Repository verified!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Docker registry is now available at: localhost:8081/docker-local" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Test with:" -ForegroundColor White
    Write-Host "  docker login localhost:8081"
    Write-Host "  docker tag myimage:latest localhost:8081/docker-local/myimage:latest"
    Write-Host "  docker push localhost:8081/docker-local/myimage:latest"
}
catch {
    Write-Host "Error creating repository:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
