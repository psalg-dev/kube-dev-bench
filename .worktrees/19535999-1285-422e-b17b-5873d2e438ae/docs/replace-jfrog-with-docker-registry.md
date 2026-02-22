# Replace JFrog with Docker Registry - Implementation Summary

## Overview

This document describes the replacement of JFrog Container Registry (JCR) with a standard Docker Registry v2 for E2E registry integration tests.

## Problem Statement

The previous implementation used JFrog Container Registry which had several issues:
- **Slow startup**: 2-3 minutes for container to be ready
- **Complex setup**: Required UI automation for EULA acceptance and repository creation
- **Heavy resource usage**: Large container image and memory footprint
- **Maintenance overhead**: Complex bootstrap logic with multiple fallback strategies
- **Flaky tests**: UI automation was brittle and error-prone

## Solution

Replace JFrog with the official Docker Registry v2 container which provides:
- **Fast startup**: Ready in seconds
- **Simple setup**: No UI, no EULA, just basic auth
- **Lightweight**: Minimal resources required
- **Reliable**: Standard Docker Registry v2 API
- **Easy maintenance**: Simple configuration

## Implementation Details

### 1. New Registry Directory Structure

Created `/registry/` directory with:

```
registry/
├── docker-compose.yml       # Docker Registry v2 container config
├── start-registry.sh        # Linux/Mac startup script
├── start-registry.ps1       # Windows startup script
├── README.md                # Complete documentation
├── .gitignore               # Excludes auth files
└── auth/                    # Created at runtime
    └── htpasswd            # Generated htpasswd file (gitignored)
```

### 2. Docker Compose Configuration

**File**: `registry/docker-compose.yml`

- Uses official `registry:2` image
- Configured with htpasswd authentication
- HTTP enabled for local testing
- Health checks for readiness
- Volume for persistent data

### 3. Startup Scripts

**Files**: `registry/start-registry.sh` and `registry/start-registry.ps1`

Both scripts:
1. Create auth directory
2. Generate htpasswd file with credentials (default: admin/password)
3. Start Docker Registry container via docker-compose
4. Wait for health check to pass
5. Verify API is accessible with authentication
6. Display connection details

### 4. Bootstrap Module

**File**: `e2e/src/support/registry-bootstrap.ts`

Simplified bootstrap logic that:
- Checks if registry is already running
- Auto-starts registry if needed using startup script
- Waits for health endpoint
- Verifies v2 API with authentication
- Returns configuration object

**Key functions**:
- `getRegistryConfig()`: Returns registry connection details
- `ensureRegistry()`: Ensures registry is running and ready

**Environment variables**:
- `E2E_REGISTRY_URL`: Registry base URL (default: `http://localhost:5000`)
- `E2E_REGISTRY_USERNAME`: Username (default: `admin`)
- `E2E_REGISTRY_PASSWORD`: Password (default: `password`)
- `E2E_SKIP_REGISTRY`: Set to `1` to skip registry setup
- `E2E_REGISTRY_READY_TIMEOUT_MS`: Timeout in ms (default: `30000`)

### 5. Test Implementation

**File**: `e2e/tests/registry/10-docker-registry.spec.ts`

Three test cases:
1. **Basic auth connection test**: Adds registry, tests connection, saves, verifies, and cleans up
2. **Invalid credentials test**: Verifies auth failures are properly detected
3. **Push/pull test**: Verifies basic registry operations work

**Key changes from JFrog test**:
- Uses `generic_v2` registry type (standard Docker Registry v2)
- Uses `http://localhost:5000` instead of `http://localhost:8082/artifactory/api/docker/docker-local`
- Simpler setup (no complex Artifactory-specific configuration)
- Faster execution (registry starts in seconds)

### 6. Global Setup Update

**File**: `e2e/src/support/global-setup-registry.ts`

Updated to call `ensureRegistry()` before running tests:
```typescript
await ensureRegistry();
```

### 7. CI Workflow Update

**File**: `.github/workflows/registry-e2e.yml`

Replaced JFrog setup steps with:
```yaml
- name: Start Docker Registry v2
  run: |
    cd registry
    bash start-registry.sh "password"
    
- name: Verify Docker Registry
  run: |
    curl -f -u admin:password http://localhost:5000/v2/_catalog
    echo "✅ Docker Registry is accessible"
```

## Comparison: Before vs After

### Startup Time
- **Before (JFrog)**: 2-3 minutes
- **After (Registry)**: ~5 seconds
- **Improvement**: ~36x faster

### Container Size
- **Before (JFrog)**: ~1.5 GB
- **After (Registry)**: ~25 MB
- **Improvement**: ~60x smaller

### Setup Complexity
- **Before (JFrog)**: 
  - UI automation with Playwright
  - EULA acceptance via API
  - Repository creation with multiple fallback strategies
  - Password configuration
  - Complex error handling
  - Log capture for debugging
  
- **After (Registry)**:
  - Generate htpasswd file
  - Start container
  - Wait for health check
  - Simple error handling

### Lines of Code
- **Before (artifactory-bootstrap.ts)**: ~400 lines
- **After (registry-bootstrap.ts)**: ~180 lines
- **Improvement**: 55% reduction

## Benefits

1. **Speed**: Tests run much faster with quick registry startup
2. **Reliability**: No UI automation means fewer flaky tests
3. **Simplicity**: Standard Docker Registry v2 API, no special handling
4. **Maintainability**: Less code, simpler logic, easier to understand
5. **Resources**: Lower memory and disk usage
6. **Portability**: Official Docker image works everywhere

## Backward Compatibility

The old JFrog implementation remains in place but is not used by the new tests:
- `e2e/src/support/artifactory-bootstrap.ts` - Still exists
- `e2e/tests/registry/61-artifactory-registry.spec.ts` - Still exists
- `jfrog/` directory - Still exists

These can be removed in a future cleanup if no longer needed.

## Testing

### Manual Testing
```bash
# Start registry
cd registry
./start-registry.sh

# Verify it works
curl -u admin:password http://localhost:5000/v2/_catalog

# Test with docker client
docker login localhost:5000
docker tag alpine:latest localhost:5000/alpine:latest
docker push localhost:5000/alpine:latest
```

### E2E Testing
```bash
# Run registry tests
cd e2e
npm run test:registry
```

## Migration Notes

If you were using JFrog and want to migrate:

1. **Stop JFrog**:
   ```bash
   cd jfrog
   docker compose down -v
   ```

2. **Start new registry**:
   ```bash
   cd registry
   ./start-registry.sh
   ```

3. **Update environment variables** (if using custom values):
   - `E2E_ARTIFACTORY_*` → `E2E_REGISTRY_*`
   - Update URLs from port 8082 to 5000
   - Update base URL from `/artifactory/api/docker/docker-local` to `/`

4. **Run tests**:
   ```bash
   cd e2e
   npm run test:registry
   ```

## Future Improvements

Possible enhancements:
1. Add HTTPS support with self-signed certificates
2. Add token authentication tests
3. Add image scanning integration tests
4. Add garbage collection tests
5. Performance benchmarks

## Conclusion

The replacement of JFrog with Docker Registry v2 significantly simplifies the E2E registry testing infrastructure while improving speed, reliability, and maintainability. The implementation provides all necessary functionality for testing registry integration without the overhead and complexity of JFrog Container Registry.
