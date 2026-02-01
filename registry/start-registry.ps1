# Start Docker Registry with authentication
# Usage: .\start-registry.ps1 [-Password "yourpassword"]
# Default password: password

param(
    [string]$Password = "password"
)

$ErrorActionPreference = "Stop"
$Username = "admin"

Write-Host "🚀 Starting Docker Registry v2..." -ForegroundColor Green
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Create auth directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "auth" | Out-Null

# Generate htpasswd file with bcrypt
Write-Host "📝 Creating htpasswd file for user: $Username" -ForegroundColor Cyan
try {
    $htpasswdOutput = docker run --rm --entrypoint htpasswd httpd:2 -Bbn $Username $Password
    $htpasswdOutput | Out-File -FilePath "auth\htpasswd" -Encoding ASCII -NoNewline
    
    if (-not (Test-Path "auth\htpasswd")) {
        throw "htpasswd file was not created"
    }
    
    Write-Host "✅ Authentication file created" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to create htpasswd file: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Start registry with docker compose
Write-Host "🐳 Starting Docker Registry container..." -ForegroundColor Cyan
docker compose up -d

Write-Host ""
Write-Host "⏳ Waiting for registry to be ready..." -ForegroundColor Yellow

# Wait for registry to be healthy
$maxAttempts = 30
$attempt = 0
$healthy = $false

while ($attempt -lt $maxAttempts) {
    $status = docker compose ps registry | Select-String "healthy"
    
    if ($status) {
        Write-Host "✅ Registry is healthy!" -ForegroundColor Green
        $healthy = $true
        break
    }
    
    $attempt++
    Start-Sleep -Seconds 1
}

if (-not $healthy) {
    Write-Host "❌ Registry failed to become healthy" -ForegroundColor Red
    Write-Host "📋 Container status:" -ForegroundColor Yellow
    docker compose ps
    Write-Host ""
    Write-Host "📋 Recent logs:" -ForegroundColor Yellow
    docker compose logs --tail=50 registry
    exit 1
}

Write-Host ""
Write-Host "🔍 Verifying registry API..." -ForegroundColor Cyan

# Verify v2 API is accessible with auth
try {
    $base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
    $headers = @{
        Authorization = "Basic $base64Auth"
    }
    
    $response = Invoke-WebRequest -Uri "http://localhost:5000/v2/" -Headers $headers -UseBasicParsing -ErrorAction Stop
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Registry API is accessible" -ForegroundColor Green
    }
    else {
        throw "Unexpected status code: $($response.StatusCode)"
    }
}
catch {
    Write-Host "❌ Registry API verification failed: $_" -ForegroundColor Red
    Write-Host "📋 Recent logs:" -ForegroundColor Yellow
    docker compose logs --tail=50 registry
    exit 1
}

Write-Host ""
Write-Host "✅ Docker Registry is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Connection details:" -ForegroundColor Cyan
Write-Host "   URL:      http://localhost:5000"
Write-Host "   Username: $Username"
Write-Host "   Password: $Password"
Write-Host ""
Write-Host "💡 Test the registry:" -ForegroundColor Yellow
Write-Host "   docker login localhost:5000"
Write-Host "   curl -u ${Username}:${Password} http://localhost:5000/v2/_catalog"
Write-Host ""
Write-Host "🛑 To stop:" -ForegroundColor Yellow
Write-Host "   docker compose down"
Write-Host ""
