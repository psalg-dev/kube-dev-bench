# JFrog Container Registry (JCR) - Local Testing

This directory contains a Docker Compose setup for running **JFrog Container Registry (JCR)** locally. JCR is a **FREE** Docker/Helm registry with full Artifactory API compatibility, authentication, and Docker Registry v2 support.

## What is JCR?

- **100% FREE** - No license required, free forever
- **Full Docker Registry v2 API** - Compatible with all Docker tools
- **Enterprise-grade** - Powered by Artifactory technology
- **Authentication enabled** - User management, API tokens, permissions
- **Production-ready** - Used by Fortune 500 companies

## Quick Start

### Option A: Automated Setup (One Command) ⭐ Recommended

Complete setup automatically with a single command:

**Windows (PowerShell):**
```powershell
cd jfrog
.\start-jcr.ps1
# Or with custom password:
.\start-jcr.ps1 -Password "YourSecurePassword"
```

**Linux/Mac (Bash):**
```bash
cd jfrog
./start-jcr.sh
# Or with custom password:
./start-jcr.sh "YourSecurePassword"
```

This will:
1. Start JCR container
2. Wait for it to be ready
3. Set admin password (default: `Admin123!`)
4. Configure base URL
5. Accept EULA
6. Create `docker-local` repository
7. Verify setup

**Default credentials after automated setup:**
- Username: `admin`
- Password: `Admin123!` (or your custom password)

You're ready to use it immediately!

### Option B: Manual Setup

1. Start JFrog Container Registry:
   ```bash
   cd jfrog
   docker compose up -d
   ```

2. Wait for startup (~30-60 seconds):
   ```bash
   docker compose logs -f jfrog-jcr
   # Wait until you see "Artifactory successfully started"
   ```

3. Run bootstrap script:

   **Windows:**
   ```powershell
   .\bootstrap-jcr.ps1
   # Or with custom password:
   .\bootstrap-jcr.ps1 -AdminPassword "YourPassword"
   ```

   **Linux/Mac:**
   ```bash
   ./bootstrap-jcr.sh
   # Or with custom password:
   ./bootstrap-jcr.sh "YourPassword"
   ```

4. Verify health:
   ```bash
   curl http://localhost:8082/artifactory/api/system/ping
   ```

### Option C: UI Setup (Legacy Method)

1. Start container: `docker compose up -d`
2. Open http://localhost:8081
3. Login with `admin` / `password`
4. Complete setup wizard manually
5. Create Docker repository via UI

## Setting Up Docker Registry

**Docker support is INCLUDED and FREE** in JCR. After completing initial setup, create a Docker repository:

### Option 1: Via Web UI (Recommended for first time)

1. Go to **Administration** > **Repositories** > **Repositories**
2. Click **Add Repository** > **Docker**
3. Choose **Local** repository
4. Enter repository key: `docker-local`
5. Set Docker API Version: **V2**
6. Click **Create**

### Option 2: Via Setup Script (After initial login) ⭐ Recommended

Run the automated setup script:

**Windows (PowerShell):**
```powershell
cd jfrog
.\setup-jcr-docker.ps1
```

**Linux/Mac (Bash):**
```bash
cd jfrog
chmod +x setup-jcr-docker.sh
./setup-jcr-docker.sh
```

This script will:
- Create the `docker-local` repository
- Configure Docker v2 API
- Verify the setup
- Provide test commands

### Option 3: Via API (Manual)

```bash
curl -u admin:YOUR_PASSWORD -X PUT \
  "http://localhost:8081/artifactory/api/repositories/docker-local" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "docker-local",
    "rclass": "local",
    "packageType": "docker",
    "description": "Local Docker registry for testing",
    "dockerApiVersion": "V2"
  }'
```

## Using Docker Registry with Authentication

### Login to Artifactory registry:
```bash
docker login localhost:8081
# Username: admin
# Password: (your Artifactory password)
```

### Push an image:
```bash
# Tag image with Artifactory registry
docker tag myimage:latest localhost:8081/docker-local/myimage:latest

# Push to Artifactory
docker push localhost:8081/docker-local/myimage:latest
```

### Pull an image:
```bash
docker pull localhost:8081/docker-local/myimage:latest
```

### List images via API (with auth):
```bash
curl -u admin:password http://localhost:8081/artifactory/api/docker/docker-local/v2/_catalog
```

## Useful Commands

```bash
# Start Artifactory
cd jfrog && docker compose up -d

# Stop Artifactory
cd jfrog && docker compose down

# Stop and remove all data (clean slate)
cd jfrog && docker compose down -v

# View logs
cd jfrog && docker compose logs -f artifactory

# Check container status
cd jfrog && docker compose ps

# Check health
curl http://localhost:8082/artifactory/api/system/ping
```

## Ports

- **8081**: Artifactory web UI and Docker registry
- **8082**: Artifactory router/API access

## Data Persistence

Artifactory data is stored in a Docker volume named `artifactory-data`. To completely reset:
```bash
cd jfrog && docker compose down -v
```

## Testing Authentication

This setup provides full authentication capabilities:

1. **User management**: Create users, groups, and permissions
2. **API tokens**: Generate tokens for programmatic access
3. **Docker authentication**: Full Docker login support
4. **Access control**: Repository-level permissions

## API Examples with Authentication

```bash
# System ping (no auth required)
curl http://localhost:8082/artifactory/api/system/ping

# Get repository list (requires auth)
curl -u admin:password http://localhost:8081/artifactory/api/repositories

# Get storage info (requires auth)
curl -u admin:password http://localhost:8081/artifactory/api/storageinfo
```

## Authentication Features

JCR includes full Artifactory authentication capabilities:

### User Management
- Create additional users via UI: Administration > Security > Users
- Assign permissions per repository
- Configure user groups

### API Tokens
Generate access tokens for programmatic access:

```bash
# Generate API key
curl -u admin:YOUR_PASSWORD -X POST http://localhost:8081/artifactory/api/security/apiKey

# Use API key for authentication
docker login localhost:8081
# Username: admin
# Password: (use your API key instead of password)
```

### Docker Authentication Methods

1. **Username/Password**: Standard credentials
2. **API Key**: Generated via API or UI
3. **Access Token**: For CI/CD pipelines
4. **Anonymous Access**: Can be configured (not recommended for testing auth)

## Notes

- This setup uses **JFrog Container Registry (JCR) 7.133.3** - FREE forever
- Includes full Docker Registry v2 API support
- Full authentication and user management included
- Default embedded Derby database (sufficient for testing)
- Perfect for testing Docker registry integrations with authentication
- No license required - completely free for unlimited use
- For production use, configure external database and add TLS
