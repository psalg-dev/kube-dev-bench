#!/bin/bash
# Bootstrap JFrog Container Registry - Complete Setup Automation
# This script automates the initial setup wizard and Docker repository creation

set -e

# Configuration
ADMIN_PASSWORD="${1:-Admin123!}"
BASE_URL="${2:-http://localhost:8081}"

echo "=== JFrog Container Registry - Automated Bootstrap ==="
echo ""

# Wait for JCR to be healthy
echo "Waiting for JCR to be ready..."
MAX_ATTEMPTS=60
ATTEMPT=0
HEALTHY=false

while [ "$HEALTHY" = "false" ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f -s http://localhost:8082/artifactory/api/system/ping > /dev/null 2>&1; then
        HEALTHY=true
        echo "✓ JCR is ready!"
    else
        ATTEMPT=$((ATTEMPT + 1))
        sleep 2
    fi
done

if [ "$HEALTHY" = "false" ]; then
    echo "Error: JCR did not become healthy in time"
    exit 1
fi

echo ""
echo "Completing initial setup wizard..."

# Default credentials before setup
DEFAULT_USER="admin"
DEFAULT_PASS="password"

# Step 1: Set admin password
echo "1. Setting admin password..."

RESPONSE=$(curl -s -w "\n%{http_code}" -u "$DEFAULT_USER:$DEFAULT_PASS" \
    -X POST "http://localhost:8081/artifactory/api/system/configuration/wizard/password" \
    -H "Content-Type: application/json" \
    -d "{
        \"password\": \"$ADMIN_PASSWORD\",
        \"retypedPassword\": \"$ADMIN_PASSWORD\"
    }" 2>/dev/null || echo "error\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✓ Admin password set"
elif [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "409" ]; then
    echo "⚠ Password already set or wizard completed"
else
    echo "⚠ Unexpected response: HTTP $HTTP_CODE"
fi

echo ""
echo "2. Configuring base URL..."

# Use new password
curl -s -u "$DEFAULT_USER:$ADMIN_PASSWORD" \
    -X PUT "http://localhost:8081/artifactory/api/system/configuration/baseUrl" \
    -H "Content-Type: application/json" \
    -d "{\"baseUrl\": \"$BASE_URL\"}" > /dev/null 2>&1 && \
    echo "✓ Base URL configured: $BASE_URL" || \
    echo "⚠ Base URL configuration skipped"

echo ""
echo "3. Accepting EULA..."

curl -s -u "$DEFAULT_USER:$ADMIN_PASSWORD" \
    -X POST "http://localhost:8081/artifactory/ui/onboarding/eula" > /dev/null 2>&1 && \
    echo "✓ EULA accepted" || \
    echo "⚠ EULA already accepted"

echo ""
echo "4. Creating docker-local repository..."

DOCKER_RESPONSE=$(curl -s -w "\n%{http_code}" -u "$DEFAULT_USER:$ADMIN_PASSWORD" \
    -X PUT "http://localhost:8081/artifactory/api/repositories/docker-local" \
    -H "Content-Type: application/json" \
    -d '{
        "key": "docker-local",
        "rclass": "local",
        "packageType": "docker",
        "description": "Local Docker registry for testing",
        "dockerApiVersion": "V2",
        "maxUniqueSnapshots": 0,
        "handleReleases": true,
        "handleSnapshots": true,
        "checksumPolicyType": "client-checksums",
        "snapshotVersionBehavior": "unique"
    }')

DOCKER_HTTP_CODE=$(echo "$DOCKER_RESPONSE" | tail -n1)

if [ "$DOCKER_HTTP_CODE" = "200" ] || [ "$DOCKER_HTTP_CODE" = "201" ]; then
    echo "✓ docker-local repository created!"
elif [ "$DOCKER_HTTP_CODE" = "400" ]; then
    echo "✓ docker-local repository already exists"
else
    echo "⚠ Unexpected response creating repository: HTTP $DOCKER_HTTP_CODE"
fi

echo ""
echo "5. Verifying setup..."

VERIFY=$(curl -s -o /dev/null -w "%{http_code}" -u "$DEFAULT_USER:$ADMIN_PASSWORD" \
    "http://localhost:8081/artifactory/api/repositories/docker-local")

if [ "$VERIFY" = "200" ]; then
    echo "✓ Setup verified!"
else
    echo "⚠ Could not verify setup (HTTP $VERIFY)"
fi

echo ""
echo "=== Bootstrap Complete ==="
echo ""
echo "Credentials:"
echo "  Username: admin"
echo "  Password: $ADMIN_PASSWORD"
echo ""
echo "Docker Registry:"
echo "  URL: localhost:8081/docker-local"
echo ""
echo "Test commands:"
echo "  docker login localhost:8081"
echo "  docker tag alpine:latest localhost:8081/docker-local/alpine:test"
echo "  docker push localhost:8081/docker-local/alpine:test"
echo ""
echo "Web UI: http://localhost:8081"
echo ""
