# Replace JFrog/Artifactory with Docker Registry for E2E Testing

Date: February 1, 2026

## Goal

Replace the JFrog Container Registry (JCR) setup with the standard open-source Docker Registry + htpasswd authentication for E2E testing. This simplifies the test infrastructure while maintaining full Docker Registry v2 API compatibility.

## Background

### Current State
- JFrog Container Registry (JCR) is used for registry E2E tests
- JCR requires complex bootstrap scripts ([jfrog/start-jcr.ps1](jfrog/start-jcr.ps1), [jfrog/bootstrap-jcr.ps1](jfrog/bootstrap-jcr.ps1))
- Startup takes 2-3 minutes due to JCR initialization
- Requires EULA acceptance, admin password setup, repository creation
- Entire `jfrog/` directory contains ~15 files for setup and documentation

### Why Change?
- **Complexity**: JCR requires multi-step bootstrap (EULA, password, base URL, repository creation)
- **Startup time**: JCR takes 2-3 minutes to become ready vs seconds for Docker Registry
- **Image size**: JCR image is ~1.5GB vs ~50MB for Docker Registry
- **No proprietary APIs used**: Our [client.go](pkg/app/docker/registry/client.go) uses only standard Docker Registry v2 APIs
- **Simpler CI**: No external dependencies, no license considerations

### API Compatibility Analysis

The registry client in [pkg/app/docker/registry/client.go](pkg/app/docker/registry/client.go) uses:
- `GET /v2/` - Version check (line 389-401)
- `GET /v2/_catalog` - List repositories (line 389-401)
- `GET /v2/{repo}/tags/list` - List tags (line 403-417)
- `GET /v2/{repo}/manifests/{ref}` - Get manifest/digest (line 419-450)
- Bearer token exchange via WWW-Authenticate challenge (line 172-264)
- Basic authentication (line 86-97)

All these are standard Docker Registry v2 / OCI Distribution APIs. The Docker Registry (distribution) project implements the same spec.

## Solution: Docker Registry with htpasswd

### Architecture
```
┌─────────────────────────────────────────┐
│  Docker Registry (registry:2)           │
│  - htpasswd authentication              │
│  - Standard V2 API                      │
│  - Port 5000                            │
└─────────────────────────────────────────┘
```

### Docker Compose Configuration
```yaml
# e2e/registry/docker-compose.yml
services:
  registry:
    image: registry:2
    container_name: e2e-registry
    ports:
      - "5000:5000"
    environment:
      REGISTRY_AUTH: htpasswd
      REGISTRY_AUTH_HTPASSWD_REALM: "E2E Registry"
      REGISTRY_AUTH_HTPASSWD_PATH: /auth/htpasswd
      REGISTRY_STORAGE_DELETE_ENABLED: "true"
    volumes:
      - ./htpasswd:/auth/htpasswd:ro
      - registry-data:/var/lib/registry
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:5000/v2/"]
      interval: 5s
      timeout: 3s
      retries: 3

volumes:
  registry-data:
```

### Test Credentials
- Username: `testuser`
- Password: `testpassword`
- htpasswd file generated with: `htpasswd -Bbn testuser testpassword > htpasswd`

## Implementation Plan

### Phase 1: Create Docker Registry Setup

#### 1.1 Create registry directory structure
Create new directory `e2e/registry/` with:
- `docker-compose.yml` - Registry container configuration
- `htpasswd` - Pre-generated credentials file
- `README.md` - Usage documentation

#### 1.2 Create bootstrap script
Create simple start/stop scripts:
- `e2e/registry/start.sh` (Linux/Mac)
- `e2e/registry/start.ps1` (Windows)

Scripts should:
- Start the registry container
- Wait for health check to pass (max 30 seconds)
- Output connection info

### Phase 2: Update E2E Test Infrastructure

#### 2.1 Create new bootstrap module
Create [e2e/src/support/registry-bootstrap.ts](e2e/src/support/registry-bootstrap.ts):
- `ensureRegistry()` - Start registry if not running
- `getRegistryConfig()` - Return connection details
- `stopRegistry()` - Cleanup after tests

Replace the Artifactory-specific functions in [e2e/src/support/artifactory-bootstrap.ts](e2e/src/support/artifactory-bootstrap.ts).

#### 2.2 Update global setup
Modify [e2e/src/support/global-setup-registry.ts](e2e/src/support/global-setup-registry.ts) to use new registry bootstrap instead of JFrog.

#### 2.3 Update E2E test specs
Update [e2e/tests/registry/61-artifactory-registry.spec.ts](e2e/tests/registry/61-artifactory-registry.spec.ts):
- Rename to `61-docker-registry.spec.ts`
- Replace `artifactory` registry type with `generic_v2` in test
- Update test descriptions
- Remove Artifactory-specific assertions

### Phase 3: Update Environment Configuration

#### 3.1 Environment variables
Replace Artifactory env vars with simpler registry config:

| Old Variable | New Variable | Default |
|--------------|--------------|---------|
| `E2E_ARTIFACTORY_URL` | `E2E_REGISTRY_URL` | `http://localhost:5000` |
| `E2E_ARTIFACTORY_USERNAME` | `E2E_REGISTRY_USERNAME` | `testuser` |
| `E2E_ARTIFACTORY_PASSWORD` | `E2E_REGISTRY_PASSWORD` | `testpassword` |
| `E2E_ARTIFACTORY_REPO` | (not needed) | - |

#### 3.2 Update playwright config
Ensure [e2e/playwright.registry.config.ts](e2e/playwright.registry.config.ts) uses the new registry bootstrap.

### Phase 4: Cleanup

#### 4.1 Remove JFrog directory
Delete the entire `jfrog/` directory (15+ files):
- `docker-compose.yml`
- `start-jcr.ps1`, `start-jcr.sh`
- `bootstrap-jcr.ps1`, `bootstrap-jcr.sh`
- `setup-jcr-docker.ps1`, `setup-jcr-docker.sh`
- `setup-docker-repo.ps1`, `setup-docker-repo.sh`
- `README.md`, `QUICK-REFERENCE.md`, `TESTING-OPTIONS.md`, `AUTHENTICATION-TESTING.md`
- `artifactory.config.import.yml`
- `tmp-artifactory.repository.config.latest.json`

#### 4.2 Remove Artifactory-specific code
- Delete [e2e/src/support/artifactory-bootstrap.ts](e2e/src/support/artifactory-bootstrap.ts)
- Delete [e2e/src/support/artifactory-ui-bootstrap.ts](e2e/src/support/artifactory-ui-bootstrap.ts)
- Delete [e2e/src/support/jfrog.ts](e2e/src/support/jfrog.ts)
- Remove JFrog references from [e2e/src/support/global-setup.ts](e2e/src/support/global-setup.ts)

#### 4.3 Update documentation
- Update [project/e2e/artifactory-e2e.md](project/e2e/artifactory-e2e.md) or delete if obsolete
- Update [CLAUDE.md](CLAUDE.md) if it references JFrog/Artifactory

### Phase 5: CI/CD Updates

#### 5.1 Update GitHub Actions
Modify registry E2E workflow to:
- Remove JFrog container setup
- Add Docker Registry container (single service)
- Reduce timeout (no longer needs 3+ minutes for JFrog startup)

## Implementation Checklist

- [ ] Create `e2e/registry/docker-compose.yml`
- [ ] Create `e2e/registry/htpasswd` (pre-generated)
- [ ] Create `e2e/registry/start.sh` and `start.ps1`
- [ ] Create `e2e/registry/README.md`
- [ ] Create `e2e/src/support/registry-bootstrap.ts`
- [ ] Update `e2e/src/support/global-setup-registry.ts`
- [ ] Rename and update registry E2E test spec
- [ ] Update environment variable handling
- [ ] Delete `jfrog/` directory
- [ ] Delete Artifactory-specific bootstrap files
- [ ] Update CI workflow
- [ ] Update project documentation
- [ ] Run full E2E registry suite to verify

## Acceptance Criteria

1. **Functional parity**: All existing registry E2E tests pass with Docker Registry
2. **Startup time**: Registry container ready in <30 seconds (vs 2-3 minutes for JCR)
3. **Simplicity**: Single docker-compose file, no bootstrap scripts required
4. **Auth testing**: Basic auth works identically to Artifactory basic auth
5. **CI compatible**: Works in GitHub Actions without additional setup

## Testing Approach

### Manual Verification
```bash
# Start registry
cd e2e/registry && docker compose up -d

# Verify auth works
curl -u testuser:testpassword http://localhost:5000/v2/_catalog

# Verify auth fails without credentials
curl http://localhost:5000/v2/_catalog  # Should return 401

# Run registry E2E tests
cd e2e && npm run test:registry
```

### API Compatibility Tests
Verify these endpoints work with htpasswd auth:
- `GET /v2/` - Returns `{}`
- `GET /v2/_catalog` - Returns `{"repositories": [...]}`
- `GET /v2/{repo}/tags/list` - Returns `{"name": "...", "tags": [...]}`
- `GET /v2/{repo}/manifests/{tag}` - Returns manifest with `Docker-Content-Digest` header

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Missing Artifactory-specific features | Our client only uses standard V2 APIs - verified in code analysis |
| Bearer token flow differences | Docker Registry supports basic auth directly; bearer flow tested separately |
| Breaking existing tests | Run full test suite before removing JFrog code |
| CI environment differences | Docker Registry works identically in CI and local environments |

## Comparison: Before vs After

| Aspect | JFrog JCR | Docker Registry |
|--------|-----------|-----------------|
| Image size | ~1.5GB | ~50MB |
| Startup time | 2-3 minutes | <10 seconds |
| Config files | 15+ files | 3 files |
| Bootstrap scripts | Complex (EULA, password, repo creation) | None (just docker compose up) |
| Auth support | Basic, Bearer, API keys | Basic (htpasswd), Bearer (token auth) |
| License | Free (with EULA) | Apache 2.0 |
| Maintenance | JFrog-specific updates | CNCF maintained |

## References

- [Docker Registry documentation](https://docs.docker.com/registry/)
- [OCI Distribution Spec](https://github.com/opencontainers/distribution-spec)
- [Docker Registry htpasswd auth](https://docs.docker.com/registry/configuration/#htpasswd)
- Current implementation: [pkg/app/docker/registry/client.go](pkg/app/docker/registry/client.go)
