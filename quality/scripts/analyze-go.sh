#!/bin/bash
set -e

REPORT_DIR="/reports"
mkdir -p "$REPORT_DIR"

echo "=== Running Go Analysis ==="

# 1. Test Coverage
echo "Running test coverage..."
go test -coverprofile="$REPORT_DIR/coverage.out" -covermode=atomic ./pkg/app/... 2>&1 | tee "$REPORT_DIR/test-output.txt"
go tool cover -func="$REPORT_DIR/coverage.out" > "$REPORT_DIR/coverage-summary.txt"
go tool cover -html="$REPORT_DIR/coverage.out" -o "$REPORT_DIR/coverage.html"

# Extract coverage percentage
COVERAGE=$(go tool cover -func="$REPORT_DIR/coverage.out" | grep total | awk '{print $3}' | sed 's/%//')
echo "{\"coverage\": $COVERAGE}" > "$REPORT_DIR/coverage.json"

# 2. golangci-lint
echo "Running golangci-lint..."
golangci-lint run --config /config/golangci.yml --out-format json ./... > "$REPORT_DIR/golangci-lint.json" 2>&1 || true
golangci-lint run --config /config/golangci.yml ./... 2>&1 | tee "$REPORT_DIR/golangci-lint.txt" || true
LINT_ISSUES=$(grep -c "^" "$REPORT_DIR/golangci-lint.txt" 2>/dev/null || echo "0")
echo "  → Found $LINT_ISSUES lint issues"

# 3. Cyclomatic Complexity
echo "Running gocyclo..."
gocyclo -over 10 -avg ./pkg/app/ 2>&1 | tee "$REPORT_DIR/gocyclo.txt" || true
CYCLO_COUNT=$(grep -c "^[0-9]" "$REPORT_DIR/gocyclo.txt" 2>/dev/null || echo "0")
echo "  → Found $CYCLO_COUNT functions with complexity > 10"

# 4. Cognitive Complexity
echo "Running gocognit..."
gocognit -over 15 ./pkg/app/ 2>&1 | tee "$REPORT_DIR/gocognit.txt" || true
COGNIT_COUNT=$(grep -c "^" "$REPORT_DIR/gocognit.txt" 2>/dev/null || echo "0")
echo "  → Found $COGNIT_COUNT functions with cognitive complexity > 15"

# 5. Code Duplication
echo "Running dupl..."
dupl -t 100 -html > "$REPORT_DIR/duplication.html" 2>&1 || true
dupl -t 100 ./pkg/app/ 2>&1 | tee "$REPORT_DIR/duplication.txt" || true
DUPL_BLOCKS=$(grep -c "duplicate of" "$REPORT_DIR/duplication.txt" 2>/dev/null || echo "0")
echo "  → Found $DUPL_BLOCKS duplicate code blocks"

# 6. Security Analysis
echo "Running gosec..."
gosec -fmt json -out "$REPORT_DIR/gosec.json" ./... 2>&1 || true
gosec -fmt html -out "$REPORT_DIR/gosec.html" ./... 2>&1 || true

echo "=== Go Analysis Complete ==="
