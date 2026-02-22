#!/bin/bash
# Setup Docker repository in Artifactory
# Run this after completing initial setup in the UI

set -e

echo "Setting up Docker repository in Artifactory..."
echo ""

# Prompt for credentials
read -p "Enter admin username [admin]: " USERNAME
USERNAME=${USERNAME:-admin}
read -sp "Enter admin password: " PASSWORD
echo ""
echo ""

# Create Docker local repository
echo "Creating docker-local repository..."
RESPONSE=$(curl -s -u "$USERNAME:$PASSWORD" -X PUT \
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

if echo "$RESPONSE" | grep -q "errors"; then
  echo "Error creating repository:"
  echo "$RESPONSE"
  exit 1
fi

echo "✓ docker-local repository created successfully!"
echo ""

# Verify repository
echo "Verifying Docker repository..."
curl -s -u "$USERNAME:$PASSWORD" \
  "http://localhost:8081/artifactory/api/repositories/docker-local" | \
  grep -q "docker-local" && echo "✓ Repository verified!"

echo ""
echo "Docker registry is now available at: localhost:8081/docker-local"
echo ""
echo "Test with:"
echo "  docker login localhost:8081"
echo "  docker tag myimage:latest localhost:8081/docker-local/myimage:latest"
echo "  docker push localhost:8081/docker-local/myimage:latest"
