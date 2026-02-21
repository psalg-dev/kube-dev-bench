# Testing JFrog Artifactory Docker Registry Integration

## The Problem

Docker registry support is **only available in Artifactory Pro/Enterprise**, not in the OSS version. However, there are several ways to test your integration without purchasing a license.

## Option 1: JFrog Container Registry (JCR) - FREE ⭐ RECOMMENDED

JFrog offers a completely **FREE** Docker/Helm registry called JFrog Container Registry:

### Features:
- 100% FREE for cloud (SaaS) and self-hosted
- Full Docker Registry v2 API support
- Enterprise-grade powered by Artifactory
- Full authentication and permissions
- Local, remote, and virtual repositories

### Self-Hosted Setup:
```yaml
services:
  jfrog-container-registry:
    image: releases-docker.jfrog.io/jfrog/artifactory-jcr:latest
    container_name: jfrog-jcr
    ports:
      - "8081:8081"
      - "8082:8082"
    volumes:
      - jcr-data:/var/opt/jfrog/artifactory
    environment:
      - JF_SHARED_DATABASE_TYPE=derby
volumes:
  jcr-data:
```

### Cloud SaaS (FREE):
Sign up at: https://jfrog.com/start-free/

**Comparison**: JCR is essentially Artifactory with Docker/Helm support only, but it's free and fully functional.

---

## Option 2: JFrog Cloud Free Trial

Get a **free trial** of the full JFrog Platform:

1. Visit: https://jfrog.com/start-free/
2. Sign up for free cloud trial
3. Access includes:
   - Artifactory Pro features
   - Docker registry support
   - Full REST API access
   - 2GB storage
   - 10GB transfer/month

**Duration**: Typically 14-30 days

---

## Option 3: Use Public API Documentation

Test against the documented API without a running instance:

### Official Documentation:
- **REST API Docs**: https://jfrog.com/help/r/jfrog-rest-apis
- **Docker Registry API**: https://jfrog.com/help/r/jfrog-artifactory-documentation/docker-registry
- **Authentication**: https://jfrog.com/help/r/jfrog-rest-apis/authentication

### Key Docker Registry Endpoints:

```bash
# Docker API v2 base
GET /artifactory/api/docker/<repo-key>/v2/

# List repositories/images
GET /artifactory/api/docker/<repo-key>/v2/_catalog

# List tags for image
GET /artifactory/api/docker/<repo-key>/v2/<image-name>/tags/list

# Get manifest
GET /artifactory/api/docker/<repo-key>/v2/<image-name>/manifests/<tag>

# Authentication token
POST /artifactory/api/security/token
GET /artifactory/api/security/apiKey
```

### Mock Testing Approach:
1. Read the API documentation
2. Create mock responses for your tests
3. Use tools like WireMock or MockServer to simulate Artifactory responses
4. Test your integration logic against the mock

---

## Option 4: Standard Docker Registry with Auth Proxy

Since Artifactory's Docker API is mostly Docker Registry v2 compliant, test with:

**Current Setup**: The Docker Registry you already have running (localhost:5000)

**Add Authentication Layer**: Use nginx or another proxy to add:
- Basic authentication
- Token authentication
- Custom headers

This simulates Artifactory's Docker API behavior.

---

## Option 5: Community/Educational License

**JFrog may offer**:
- Educational licenses for students/academia
- Open source project licenses
- Community developer licenses

Contact JFrog sales about testing/development licenses.

---

## Recommended Approach for Your Use Case

Based on your goal to test Docker registry integration with authentication:

### Best: Use JFrog Container Registry (FREE)
- **Pros**: 100% real Artifactory API, free, full Docker support, authentication
- **Cons**: None for testing purposes
- **Setup Time**: 5 minutes

### Alternative: JFrog Cloud Free Trial
- **Pros**: Full Pro features, cloud-hosted (no local resources)
- **Cons**: Time-limited, requires sign-up
- **Setup Time**: 10 minutes

### For CI/CD Testing: Mock Server
- **Pros**: No external dependencies, fast, offline
- **Cons**: Not real Artifactory behavior, maintenance overhead
- **Setup Time**: 30-60 minutes

---

## Next Steps

Choose one of the above options. For JCR (recommended), I can help you:

1. Update docker-compose.yml to use JCR image
2. Configure Docker repository
3. Test authentication
4. Verify API compatibility

Let me know which approach you'd like to pursue!

---

## Sources

- [JFrog Container Registry (Free)](https://jfrog.com/container-registry/)
- [Docker Registry Integration](https://jfrog.com/integrations/docker-registry/)
- [Set Up Docker Registry Tutorial](https://jfrog.com/blog/how-to-set-up-a-private-remote-and-virtual-docker-registry/)
- [JFrog Container Registry Announcement](https://jfrog.com/blog/announcing-jfrog-container-registry/)
- [Get Started with Artifactory as Docker Registry](https://jfrog.com/help/r/jfrog-artifactory-documentation/get-started-with-artifactory-as-a-docker-registry)
