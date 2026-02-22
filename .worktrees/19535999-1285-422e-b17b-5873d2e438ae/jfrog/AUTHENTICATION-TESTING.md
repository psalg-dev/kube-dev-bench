# Testing JFrog Container Registry Authentication

This guide shows how to test various authentication methods with JFrog Container Registry (JCR).

## Prerequisites

1. JCR is running: `docker compose ps`
2. Initial setup completed at http://localhost:8081
3. Admin password has been set
4. Docker repository created (run `setup-jcr-docker.ps1` or `.sh`)

## 1. Basic Authentication (Username/Password)

### Test via Docker CLI

```bash
# Login with username and password
docker login localhost:8081
# Username: admin
# Password: (your admin password)

# Expected output: "Login Succeeded"
```

### Test via curl

```bash
# Test with valid credentials
curl -u admin:YOUR_PASSWORD http://localhost:8081/artifactory/api/repositories

# Expected: JSON list of repositories

# Test with invalid credentials
curl -u admin:wrongpassword http://localhost:8081/artifactory/api/repositories

# Expected: 401 Unauthorized
```

## 2. API Key Authentication

### Generate API Key

```bash
# Generate API key via API
curl -u admin:YOUR_PASSWORD -X POST \
  http://localhost:8081/artifactory/api/security/apiKey

# Response: Your API key string
```

Or generate via UI:
1. Go to http://localhost:8081
2. Click on your username (top right) > Edit Profile
3. Enter password
4. Click "Generate API Key"

### Test API Key

```bash
# Use API key instead of password
docker login localhost:8081
# Username: admin
# Password: (paste your API key)

# Test via curl
curl -u admin:YOUR_API_KEY http://localhost:8081/artifactory/api/repositories
```

## 3. Access Token Authentication

### Generate Access Token

```bash
# Generate access token
curl -u admin:YOUR_PASSWORD -X POST \
  "http://localhost:8081/artifactory/api/security/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&scope=member-of-groups:readers"

# Response includes: "access_token": "your-token-here"
```

### Test Access Token

```bash
# Use token with Bearer authentication
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8081/artifactory/api/repositories

# Test Docker Registry API with token
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8081/artifactory/api/docker/docker-local/v2/_catalog
```

## 4. Test Docker Registry Authentication

### Push Image with Authentication

```bash
# 1. Login
docker login localhost:8081

# 2. Pull a test image
docker pull alpine:latest

# 3. Tag for your registry
docker tag alpine:latest localhost:8081/docker-local/alpine:test

# 4. Push (authentication will be verified)
docker push localhost:8081/docker-local/alpine:test

# Expected: Successful push with digest
```

### Pull Image with Authentication

```bash
# Remove local image
docker rmi localhost:8081/docker-local/alpine:test

# Pull from registry (requires authentication)
docker pull localhost:8081/docker-local/alpine:test

# Expected: Successful pull
```

### Test Unauthenticated Access

```bash
# Logout
docker logout localhost:8081

# Try to push without auth
docker push localhost:8081/docker-local/alpine:test

# Expected: "unauthorized: authentication required"
```

## 5. Test API Authentication

### List Images with Auth

```bash
# Get catalog (requires auth)
curl -u admin:YOUR_PASSWORD \
  http://localhost:8081/artifactory/api/docker/docker-local/v2/_catalog

# Expected: {"repositories":["alpine"]}
```

### List Tags with Auth

```bash
# Get tags for image
curl -u admin:YOUR_PASSWORD \
  http://localhost:8081/artifactory/api/docker/docker-local/v2/alpine/tags/list

# Expected: {"name":"alpine","tags":["test"]}
```

### Test Without Auth

```bash
# Try catalog without auth
curl http://localhost:8081/artifactory/api/docker/docker-local/v2/_catalog

# Expected: 401 Unauthorized
```

## 6. Create Test User (Optional)

### Create User via UI

1. Go to Administration > Security > Users
2. Click "New User"
3. Fill in details:
   - Username: `testuser`
   - Password: `TestPass123!`
   - Email: `test@example.com`
4. Save

### Assign Permissions

1. Go to Administration > Security > Permissions
2. Create new permission target or edit existing
3. Add `testuser` to Users tab
4. Grant "Deploy/Cache" and "Read" permissions

### Test New User

```bash
# Login as test user
docker login localhost:8081
# Username: testuser
# Password: TestPass123!

# Test API access
curl -u testuser:TestPass123! \
  http://localhost:8081/artifactory/api/docker/docker-local/v2/_catalog
```

## 7. Test Permission Denied

### Remove User Permissions

1. Go to Administration > Security > Permissions
2. Remove testuser from docker-local permissions

### Verify Access Denied

```bash
# Try to access as testuser (should fail)
curl -u testuser:TestPass123! \
  http://localhost:8081/artifactory/api/docker/docker-local/v2/_catalog

# Expected: 403 Forbidden or empty catalog
```

## 8. Integration Testing Checklist

Use this checklist for testing your integration:

- [ ] Can connect to JCR API endpoint
- [ ] Receives 401 without credentials
- [ ] Successfully authenticates with username/password
- [ ] Successfully authenticates with API key
- [ ] Successfully authenticates with access token
- [ ] Can list Docker repositories with auth
- [ ] Can list images in repository with auth
- [ ] Can list tags for image with auth
- [ ] Can get image manifest with auth
- [ ] Proper error handling for invalid credentials
- [ ] Proper error handling for expired tokens
- [ ] Proper error handling for insufficient permissions

## 9. Common Authentication Issues

### Issue: "Bad credentials"
- **Cause**: Wrong username or password
- **Fix**: Verify credentials, try API key instead

### Issue: "Unauthorized"
- **Cause**: No authentication provided
- **Fix**: Include `-u username:password` or Bearer token

### Issue: "Forbidden"
- **Cause**: User lacks permissions
- **Fix**: Check user permissions in UI under Administration > Security

### Issue: Docker login fails
- **Cause**: Port or URL incorrect
- **Fix**: Ensure using `localhost:8081` not just `localhost`

## 10. API Endpoints Reference

```bash
# Authentication
POST /artifactory/api/security/apiKey          # Generate API key
POST /artifactory/api/security/token          # Generate access token
GET  /artifactory/api/security/currentuser    # Get current user info

# Docker Registry v2 API
GET  /artifactory/api/docker/<repo>/v2/                        # API version check
GET  /artifactory/api/docker/<repo>/v2/_catalog                # List images
GET  /artifactory/api/docker/<repo>/v2/<image>/tags/list       # List tags
GET  /artifactory/api/docker/<repo>/v2/<image>/manifests/<tag> # Get manifest

# Repository Management
GET  /artifactory/api/repositories              # List all repositories
GET  /artifactory/api/repositories/<repo>       # Get repository details
```

## Testing Your Integration

When testing your Docker registry client integration:

1. **Start with basic auth**: Username/password
2. **Test API key flow**: Generate and use API keys
3. **Test token flow**: Generate and use access tokens
4. **Test permission denial**: Create user without permissions
5. **Test invalid credentials**: Verify proper error handling
6. **Test all Docker v2 API endpoints**: Catalog, tags, manifests

This ensures your integration handles all authentication scenarios correctly.
