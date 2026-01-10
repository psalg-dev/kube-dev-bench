#!/bin/bash
# One-command JCR setup - Starts JCR and runs bootstrap automatically
# Usage: ./start-jcr.sh [password]

set -e

PASSWORD="${1:-Admin123!}"

echo "=== Starting JFrog Container Registry ==="
echo ""

# Start docker compose
echo "Starting JCR container..."
docker compose up -d

echo "✓ Container started"
echo ""

# Run bootstrap
echo "Running automated bootstrap..."
echo ""

if bash "$(dirname "$0")/bootstrap-jcr.sh" "$PASSWORD"; then
    echo ""
    echo "=== JCR Ready! ==="
    echo ""
    echo "Quick test:"
    echo "  docker login localhost:8081"
    echo "  # Username: admin"
    echo "  # Password: $PASSWORD"
    echo ""
else
    echo ""
    echo "Bootstrap failed. You can:"
    echo "  1. Complete setup manually at http://localhost:8081"
    echo "  2. Run bootstrap again: ./bootstrap-jcr.sh"
    exit 1
fi
