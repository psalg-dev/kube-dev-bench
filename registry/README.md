# Docker Registry v2 - Local Testing

This directory contains a Docker Compose setup for running a **standard Docker Registry v2** locally for E2E testing.

## What is Docker Registry v2?

- **Official Docker registry implementation** - The same code running on Docker Hub
- **Simple and lightweight** - Starts in seconds
- **Full Docker Registry v2 API** - Compatible with all Docker tools
- **Authentication support** - Basic auth with htpasswd
- **Open source** - Apache 2.0 licensed

## Quick Start

### Automated Setup (One Command) ⭐ Recommended

**Linux/Mac (Bash):**
```bash
cd registry
./start-registry.sh
# Or with custom password:
./start-registry.sh "YourSecurePassword"
```

**Windows (PowerShell):**
```powershell
cd registry
.\start-registry.ps1
# Or with custom password:
.\start-registry.ps1 -Password "YourSecurePassword"
```

This will:
1. Create htpasswd file with credentials
2. Start Docker Registry container
3. Wait for it to be ready
4. Verify setup

**Default credentials after automated setup:**
- Username: `admin`
- Password: `password` (or your custom password)

You're ready to use it immediately!

### Manual Setup

1. Create auth directory and htpasswd file:
   ```bash
   cd registry
   mkdir -p auth
   # Create htpasswd file with admin user (password: password)
   docker run --rm --entrypoint htpasswd httpd:2 -Bbn admin password > auth/htpasswd
   ```

2. Start Docker Registry:
   ```bash
   docker compose up -d
   ```

3. Verify health:
   ```bash
   curl http://localhost:5000/v2/
   # Should return: {}
   ```

## Using Docker Registry

### Login to registry:
```bash
docker login localhost:5000
# Username: admin
# Password: password
```

### Push an image:
```bash
# Tag image with registry
docker tag myimage:latest localhost:5000/myimage:latest

# Push to registry
docker push localhost:5000/myimage:latest
```

### Pull an image:
```bash
docker pull localhost:5000/myimage:latest
```

### List images via API (with auth):
```bash
curl -u admin:password http://localhost:5000/v2/_catalog
```

## Useful Commands

```bash
# Start registry
cd registry && docker compose up -d

# Stop registry
cd registry && docker compose down

# Stop and remove all data (clean slate)
cd registry && docker compose down -v

# View logs
cd registry && docker compose logs -f registry

# Check container status
cd registry && docker compose ps

# Check health
curl http://localhost:5000/v2/
```

## Ports

- **5000**: Docker Registry v2 API

## Data Persistence

Registry data is stored in a Docker volume named `registry-data`. To completely reset:
```bash
cd registry && docker compose down -v
```

## Authentication

The registry is configured to use htpasswd authentication:
- Default user: `admin`
- Default password: `password`

To add more users:
```bash
cd registry
docker run --rm --entrypoint htpasswd httpd:2 -Bbn username password >> auth/htpasswd
docker compose restart registry
```

## API Examples with Authentication

```bash
# Check v2 endpoint (requires auth)
curl -u admin:password http://localhost:5000/v2/

# List repositories
curl -u admin:password http://localhost:5000/v2/_catalog

# List tags for a repository
curl -u admin:password http://localhost:5000/v2/myimage/tags/list
```

## Environment Variables for E2E Tests

The E2E tests can be configured with these environment variables:

- `E2E_REGISTRY_URL` - Registry base URL (default: `http://localhost:5000`)
- `E2E_REGISTRY_USERNAME` - Username (default: `admin`)
- `E2E_REGISTRY_PASSWORD` - Password (default: `password`)
- `E2E_SKIP_REGISTRY` - Set to `1` to skip registry setup
- `E2E_REGISTRY_READY_TIMEOUT_MS` - Timeout in ms (default: `30000`)

## Advantages over JFrog

- ✅ **Faster startup** - Seconds instead of minutes
- ✅ **No UI setup** - No EULA acceptance, no wizard
- ✅ **Simpler** - Standard Docker Registry v2 API
- ✅ **Lighter** - Smaller image, less resources
- ✅ **More reliable** - Fewer moving parts
- ✅ **Standard** - Official Docker implementation
