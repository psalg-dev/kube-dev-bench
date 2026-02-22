#!/bin/bash
# Quick checks for pre-commit or rapid feedback

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QUALITY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$QUALITY_DIR"

echo "Running quick quality checks..."

# Run only fast checks (lint + security scan)
docker compose run --rm go-analyzer bash -c "golangci-lint run --fast ./..."
docker compose run --rm js-analyzer npm run lint
docker compose run --rm secrets-scanner

echo "Quick checks complete!"
