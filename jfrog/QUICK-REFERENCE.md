# JFrog Container Registry - Quick Reference

## One-Command Setup (Easiest)

**Windows:**
```powershell
cd jfrog
.\start-jcr.ps1
```

**Linux/Mac:**
```bash
cd jfrog
./start-jcr.sh
```

This automatically:
- Starts JCR
- Sets admin password to `Admin123!`
- Configures base URL
- Accepts EULA
- Creates docker-local repository
- Verifies setup

**Custom password:**
```powershell
.\start-jcr.ps1 -Password "MySecurePassword"  # Windows
./start-jcr.sh "MySecurePassword"              # Linux/Mac
```

## Manual Steps

If you prefer manual control:

### 1. Start Container
```bash
docker compose up -d
```

### 2. Run Bootstrap
```powershell
.\bootstrap-jcr.ps1                           # Windows
./bootstrap-jcr.sh                             # Linux/Mac
```

### 3. Or Setup Docker Repo Only (if already configured)
```powershell
.\setup-jcr-docker.ps1                        # Windows
./setup-jcr-docker.sh                          # Linux/Mac
```

## Quick Test

```bash
# Login
docker login localhost:8081
# Username: admin
# Password: Admin123! (or your custom password)

# Test push
docker pull alpine:latest
docker tag alpine:latest localhost:8081/docker-local/alpine:test
docker push localhost:8081/docker-local/alpine:test

# Verify via API
curl -u admin:Admin123! \
  http://localhost:8081/artifactory/api/docker/docker-local/v2/_catalog
```

## Available Scripts

| Script | Purpose | Platform |
|--------|---------|----------|
| `start-jcr.ps1/.sh` | One-command: Start + Bootstrap | Both |
| `bootstrap-jcr.ps1/.sh` | Automated initial setup | Both |
| `setup-jcr-docker.ps1/.sh` | Create Docker repo (post-setup) | Both |
| `setup-docker-repo.ps1/.sh` | Legacy Docker repo setup | Both |

## Common Commands

```bash
# Start JCR
docker compose up -d

# Stop JCR
docker compose down

# Stop and delete data (fresh start)
docker compose down -v

# View logs
docker compose logs -f jfrog-jcr

# Check status
docker compose ps

# Check health
curl http://localhost:8082/artifactory/api/system/ping
```

## Access

- **Web UI**: http://localhost:8081
- **API**: http://localhost:8082
- **Docker Registry**: localhost:8081/docker-local

## Default Credentials (Automated Setup)

- **Username**: `admin`
- **Password**: `Admin123!` (or your custom password)

## Authentication Methods

1. **Username/Password**: Direct login
2. **API Key**: Generate via UI or API
3. **Access Token**: For CI/CD

See [AUTHENTICATION-TESTING.md](AUTHENTICATION-TESTING.md) for detailed testing guide.

## Documentation Files

- **[README.md](README.md)** - Complete documentation
- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - This file
- **[AUTHENTICATION-TESTING.md](AUTHENTICATION-TESTING.md)** - Auth testing guide
- **[TESTING-OPTIONS.md](TESTING-OPTIONS.md)** - Alternative testing approaches

## Troubleshooting

### Container won't start
```bash
docker compose down -v
docker compose up -d
```

### Bootstrap fails
- Wait longer (JCR needs ~30-60 seconds to start)
- Check logs: `docker compose logs jfrog-jcr`
- Complete setup manually at http://localhost:8081

### Can't login to Docker
- Verify credentials
- Check JCR is running: `docker compose ps`
- Test health: `curl http://localhost:8082/artifactory/api/system/ping`

### 401 Unauthorized
- Wrong username or password
- Try using API key instead of password
- Verify user has permissions

## Getting Started (New User)

1. Run one command:
   ```bash
   ./start-jcr.sh  # or start-jcr.ps1 on Windows
   ```

2. Test it works:
   ```bash
   docker login localhost:8081
   # admin / Admin123!
   ```

3. Start testing your integration!

That's it! 🎉
