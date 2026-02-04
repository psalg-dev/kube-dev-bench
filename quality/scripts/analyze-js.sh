#!/bin/sh
set -e

REPORT_DIR="/reports"
mkdir -p "$REPORT_DIR"
mkdir -p "$REPORT_DIR/coverage"

echo "=== Running JavaScript Analysis ==="

# The workspace mount is /workspace which IS the frontend directory (../frontend mounted)
# Copy to writable location since it's mounted read-only
WORK_DIR="/tmp/frontend"
echo "Copying /workspace to $WORK_DIR..."
cp -r /workspace "$WORK_DIR"
cd "$WORK_DIR"

echo "Working directory contents:"
ls -la

# Install dependencies (needed for ESLint plugins and test running)
echo "Installing dependencies..."
npm ci 2>/dev/null || npm install 2>/dev/null || echo "Skipping npm install"

# 1. Test Coverage
echo "Running vitest coverage..."
# Run vitest with coverage - explicitly request json-summary reporter for aggregation
# The --coverage.reporter flag adds to existing reporters from config
npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text --coverage.reporter=lcov 2>&1 | tee "$REPORT_DIR/test-output.txt" || true

# Copy coverage from default location to reports
echo "Copying coverage reports..."
if [ -f "./coverage/coverage-summary.json" ]; then
  echo "Found coverage-summary.json, copying..."
  cp -r ./coverage/* "$REPORT_DIR/coverage/" 2>/dev/null || true
  echo "Coverage files copied successfully"
else
  echo "Warning: coverage-summary.json not found in ./coverage/"
  echo "Available coverage files:"
  ls -la ./coverage/ 2>/dev/null || echo "coverage directory does not exist"
  # Try to copy any coverage files that exist anyway
  cp -r ./coverage/* "$REPORT_DIR/coverage/" 2>/dev/null || true
fi

# 2. ESLint
echo "Running ESLint..."
npx eslint src/ --format json --output-file "$REPORT_DIR/eslint.json" || true
npx eslint src/ --format stylish > "$REPORT_DIR/eslint.txt" 2>&1 || true

# 3. Code Duplication
echo "Running jscpd..."
npx jscpd src/ --reporters json --output "$REPORT_DIR" || true

# 4. Complexity Analysis
echo "Running plato..."
npx plato -r -d "$REPORT_DIR/plato" src/ || true

# 5. npm audit
echo "Running npm audit..."
npm audit --json > "$REPORT_DIR/npm-audit.json" 2>&1 || true

# 6. Bundle Analysis (optional)
echo "Analyzing bundle size..."
npm run build -- --report 2>/dev/null || true

echo "=== JavaScript Analysis Complete ==="
