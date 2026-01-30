# JFrog Artifactory JCR 7.133.3 Known Issues

## Summary

JFrog Artifactory JCR version 7.133.3 has significant breaking changes that prevent it from working properly in a simple single-container Docker Compose setup. This document details the issues discovered and provides recommendations.

## Issues Discovered

### 1. Master Key and Join Key Requirements (Breaking Change)

**Version 7.71.10 Behavior:**
- Could start without pre-configured security keys
- Keys were generated automatically on first run

**Version 7.133.3 Behavior:**
- Requires `master.key` and `join.key` files to be present BEFORE first startup
- Environment variables alone (`JF_SHARED_SECURITY_MASTERKEY`, `JF_SHARED_SECURITY_JOINKEY`) are NOT sufficient
- Keys must be mounted as files at:
  - `/var/opt/jfrog/artifactory/etc/security/master.key`
  - `/var/opt/jfrog/artifactory/etc/security/join.key`

**Fix Applied:**
- Created security directory with pre-generated keys
- Updated docker-compose.yml to mount these files

### 2. Access Service Fails to Start

**Symptoms:**
```
Cluster join: Retry X: Access Service ping failed, will retry. 
Error: cluster join: error from service registry on ping: 
url=http://localhost:8040/access/api/v1/system/ping, status code=404
```

**Root Cause:**
- The Access Service (port 8046) never becomes available
- The Router (port 8040) returns 404 errors
- Multiple services fail to initialize properly:
  - `jfrou` (Router)
  - `jfcfg` (Configuration)
  - `jfevt` (Events)
  - `jffe` (Frontend)

**Impact:**
- Container never becomes healthy
- API endpoint `/artifactory/api/system/ping` never responds
- E2E tests cannot run

### 3. Architectural Changes

Version 7.133.3 appears to require a more complex multi-service architecture that is not compatible with the simple single-container JCR free edition setup.

## Attempted Fixes

1. ✅ Added master.key and join.key files
2. ✅ Mounted keys as files in docker-compose.yml
3. ❌ Access Service still fails to start
4. ❌ Container never becomes healthy after 5+ minutes

## Recommendations

### Option 1: Revert to 7.71.10 (Recommended for Stability)

The previous version (7.71.10) works reliably with the current setup:
- No pre-configuration of security keys required
- Access Service starts properly
- All E2E tests pass

```yaml
services:
  artifactory:
    image: releases-docker.jfrog.io/jfrog/artifactory-jcr:7.71.10
    # ... rest of configuration
```

### Option 2: Find a Working Intermediate Version

Test versions between 7.71.10 and 7.133.3 to find the last working version:
- 7.90.x
- 7.100.x
- 7.120.x

### Option 3: Wait for JFrog Bug Fix

Version 7.133.3 may have a bug that JFrog will fix in a future release. Monitor:
- JFrog release notes
- GitHub issues for artifactory-docker-examples
- Community forums

### Option 4: Switch to artifactory-oss

Consider using the open-source version instead:
```yaml
services:
  artifactory:
    image: releases-docker.jfrog.io/jfrog/artifactory-oss:latest
```

## Testing Commands

To verify if a version works:

```bash
cd jfrog
docker compose down -v
docker compose up -d
sleep 120  # Wait for startup
curl -f http://localhost:8082/artifactory/api/system/ping
```

Expected output for working version:
```
OK
```

## References

- [JFrog Master Key Documentation](https://jfrog.com/help/r/what-are-the-artifactory-key-master-key-and-what-are-they-used-for/the-master.key)
- [JFrog Docker Installation Guide](https://jfrog.com/help/r/jfrog-installation-setup-documentation/install-artifactory-using-docker)
- [Original working version](https://github.com/psalg-dev/kube-dev-bench/blob/main/jfrog/README.md#L259) (7.71.10)

## Conclusion

**Version 7.133.3 is NOT RECOMMENDED** for the kube-dev-bench project at this time. We recommend:

1. **Short term:** Reject the Renovate PR and keep 7.71.10
2. **Medium term:** Test intermediate versions to find a working upgrade path
3. **Long term:** Monitor JFrog releases for fixes to 7.133.3 issues

## Date

January 30, 2026
