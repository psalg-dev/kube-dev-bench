#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
QUALITY_DIR="$(dirname "$SCRIPT_DIR")"

cd "$QUALITY_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║   KubeDevBench Code Quality Analysis     ║"
echo "╚══════════════════════════════════════════╝"

# Clean previous reports (use docker to handle permission issues from container-created files)
docker run --rm -v "$(pwd)/reports:/reports" alpine sh -c 'rm -rf /reports/go /reports/js /reports/security /reports/combined && mkdir -p /reports/go /reports/js /reports/security /reports/combined'

# Build containers first
echo ""
echo "Building analysis containers..."
docker compose build

# Run analyzers in parallel
echo ""
echo "Starting all analyzers in parallel..."

# Start all analyzers as background processes
docker compose run --rm go-analyzer &
GO_PID=$!
echo "  [PID $GO_PID] Go analyzer started"

docker compose run --rm js-analyzer &
JS_PID=$!
echo "  [PID $JS_PID] JS analyzer started"

docker compose run --rm security-scanner &
SEC_PID=$!
echo "  [PID $SEC_PID] Security scanner started"

docker compose run --rm secrets-scanner &
SECRETS_PID=$!
echo "  [PID $SECRETS_PID] Secrets scanner started"

docker compose run --rm cloc &
CLOC_PID=$!
echo "  [PID $CLOC_PID] CLOC started"

echo ""
echo "Waiting for all analyzers to complete..."

# Wait for all and capture exit codes
wait $GO_PID || echo "Go analyzer completed with warnings"
echo "  ✓ Go analyzer finished"

wait $JS_PID || echo "JS analyzer completed with warnings"
echo "  ✓ JS analyzer finished"

wait $SEC_PID || echo "Security scanner completed with warnings"
echo "  ✓ Security scanner finished"

wait $SECRETS_PID || echo "Secrets scanner completed"
echo "  ✓ Secrets scanner finished"

wait $CLOC_PID || echo "CLOC completed"
echo "  ✓ CLOC finished"

echo ""
echo "All analyzers completed!"

# Run report aggregator
echo ""
echo "Aggregating reports..."
docker compose --profile aggregate run --rm report-aggregator

# Check quality gates
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✓ All quality gates passed!"
    echo "  View report: reports/combined/index.html"
else
    echo ""
    echo "✗ Quality gates failed!"
    echo "  View report: reports/combined/index.html"
fi

exit $EXIT_CODE
