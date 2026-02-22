#!/usr/bin/env bash
set -euo pipefail

# Start Docker Registry with authentication
# Usage: ./start-registry.sh [password]
# Default password: password

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PASSWORD="${1:-password}"
USERNAME="admin"

echo "🚀 Starting Docker Registry v2..."
echo ""

# Create auth directory if it doesn't exist
mkdir -p auth

# Generate htpasswd file with bcrypt
echo "📝 Creating htpasswd file for user: $USERNAME"
docker run --rm --entrypoint htpasswd httpd:2 -Bbn "$USERNAME" "$PASSWORD" > auth/htpasswd

if [ ! -f auth/htpasswd ]; then
    echo "❌ Failed to create htpasswd file"
    exit 1
fi

echo "✅ Authentication file created"
echo ""

# Start registry with docker compose
echo "🐳 Starting Docker Registry container..."
docker compose up -d

echo ""
echo "⏳ Waiting for registry to be ready..."

# Wait for registry to be healthy
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker compose ps registry | grep -q "healthy"; then
        echo "✅ Registry is healthy!"
        break
    fi
    
    if [ $attempt -ge $max_attempts ]; then
        echo "❌ Registry failed to become healthy"
        echo "📋 Container status:"
        docker compose ps
        echo ""
        echo "📋 Recent logs:"
        docker compose logs --tail=50 registry
        exit 1
    fi
    
    attempt=$((attempt + 1))
    sleep 1
done

echo ""
echo "🔍 Verifying registry API..."

# Verify v2 API is accessible with auth
if curl -s -f -u "$USERNAME:$PASSWORD" http://localhost:5000/v2/ > /dev/null; then
    echo "✅ Registry API is accessible"
else
    echo "❌ Registry API verification failed"
    echo "📋 Recent logs:"
    docker compose logs --tail=50 registry
    exit 1
fi

echo ""
echo "✅ Docker Registry is ready!"
echo ""
echo "📋 Connection details:"
echo "   URL:      http://localhost:5000"
echo "   Username: $USERNAME"
echo "   Password: $PASSWORD"
echo ""
echo "💡 Test the registry:"
echo "   docker login localhost:5000"
echo "   curl -u $USERNAME:$PASSWORD http://localhost:5000/v2/_catalog"
echo ""
echo "🛑 To stop:"
echo "   docker compose down"
echo ""
