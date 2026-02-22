#!/bin/bash
# Setup Docker repository in JFrog Container Registry
# This script configures JCR after initial setup

set -e

echo "=== JFrog Container Registry - Docker Setup ==="
echo ""

# Prompt for credentials
echo "Enter your JCR credentials (set during initial login)"
read -p "Username [admin]: " USERNAME
USERNAME=${USERNAME:-admin}
read -sp "Password: " PASSWORD
echo ""
echo ""

# Create Docker local repository
echo "Creating docker-local repository..."
RESPONSE=$(curl -s -w "\n%{http_code}" -u "$USERNAME:$PASSWORD" -X PUT \
  "http://localhost:8081/artifactory/api/repositories/docker-local" \
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

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo "✓ docker-local repository created!"
  echo ""
elif [ "$HTTP_CODE" -eq 400 ]; then
  echo "Repository may already exist, checking..."
else
  echo "Error creating repository (HTTP $HTTP_CODE):"
  echo "$BODY"
  exit 1
fi

# Verify repository
echo "Verifying Docker repository..."
VERIFY=$(curl -s -u "$USERNAME:$PASSWORD" \
  "http://localhost:8081/artifactory/api/repositories/docker-local")

if echo "$VERIFY" | grep -q "docker-local"; then
  echo "✓ Repository verified and ready!"
  echo ""
  echo "=== Docker Registry Configuration ==="
  echo "Registry URL: localhost:8081/docker-local"
  echo "Repository Key: docker-local"
  echo "Package Type: Docker (v2)"
  echo ""
  echo "=== Test Your Setup ==="
  echo ""
  echo "1. Login to registry:"
  echo "   docker login localhost:8081"
  echo "   Username: $USERNAME"
  echo "   Password: (your JCR password)"
  echo ""
  echo "2. Tag an image:"
  echo "   docker tag alpine:latest localhost:8081/docker-local/alpine:test"
  echo ""
  echo "3. Push the image:"
  echo "   docker push localhost:8081/docker-local/alpine:test"
  echo ""
  echo "4. List images via API:"
  echo "   curl -u ${USERNAME}:PASSWORD http://localhost:8081/artifactory/api/docker/docker-local/v2/_catalog"
  echo ""
  echo "✓ Setup complete!"
else
  echo "Error: Could not verify repository"
  exit 1
fi
