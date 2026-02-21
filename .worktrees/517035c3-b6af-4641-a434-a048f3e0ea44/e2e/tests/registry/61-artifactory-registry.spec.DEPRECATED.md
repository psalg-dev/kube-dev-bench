# Deprecation Notice: Artifactory Registry Test

⚠️ **This test file is deprecated and should not be used.**

## What Changed

The registry E2E tests have been migrated from JFrog Container Registry (Artifactory) to the standard Docker Registry v2.

## Use This Instead

Use the new Docker Registry v2 test: `e2e/tests/registry/10-docker-registry.spec.ts`

## Why the Change

The new implementation provides:
- **36x faster startup** (5 seconds vs 2-3 minutes)
- **60x smaller container** (25 MB vs 1.5 GB)
- **No UI automation** required
- **Standard Docker Registry v2 API**
- **More reliable tests**

## Migration

If you need to test with a real registry:

1. **Start the new Docker Registry**:
   ```bash
   cd registry
   ./start-registry.sh
   ```

2. **Run the new tests**:
   ```bash
   cd e2e
   npm run test:registry
   ```

## Documentation

See `docs/replace-jfrog-with-docker-registry.md` for complete implementation details.

## Old JFrog Setup

If you still need to use JFrog for some reason:
```bash
cd jfrog
./start-jcr.sh
```

However, this is not recommended and may be removed in future versions.
