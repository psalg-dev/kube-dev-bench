#!/usr/bin/env bash
#
# VS Code Copilot agent Stop hook — checks for unresolved pre-existing errors
# and runs compile/lint validation before allowing the agent to stop.
#
# Receives JSON on stdin with:
#   - stop_hook_active: boolean (true if already re-running after a previous block)
#   - transcript_path: path to the conversation transcript JSON
#   - cwd: workspace root directory
#
set -euo pipefail

# ── Read hook input from stdin ──────────────────────────────────────────────
RAW_INPUT=""
if ! RAW_INPUT=$(cat 2>/dev/null); then
    exit 0
fi

if [ -z "$RAW_INPUT" ]; then
    exit 0
fi

# ── Parse fields (using jq if available, otherwise grep fallback) ───────────
if command -v jq &>/dev/null; then
    STOP_HOOK_ACTIVE=$(echo "$RAW_INPUT" | jq -r '.stop_hook_active // false')
    TRANSCRIPT_PATH=$(echo "$RAW_INPUT" | jq -r '.transcript_path // empty')
    WORKSPACE_ROOT=$(echo "$RAW_INPUT" | jq -r '.cwd // empty')
else
    # Fallback: simple grep-based parsing
    STOP_HOOK_ACTIVE=$(echo "$RAW_INPUT" | grep -oP '"stop_hook_active"\s*:\s*\K(true|false)' || echo "false")
    TRANSCRIPT_PATH=$(echo "$RAW_INPUT" | grep -oP '"transcript_path"\s*:\s*"\K[^"]+' || echo "")
    WORKSPACE_ROOT=$(echo "$RAW_INPUT" | grep -oP '"cwd"\s*:\s*"\K[^"]+' || echo "")
fi

[ -z "$WORKSPACE_ROOT" ] && WORKSPACE_ROOT="$(pwd)"

# ── Guard: prevent infinite loops ───────────────────────────────────────────
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
    exit 0
fi

ISSUES=()

# ── 1. Check transcript for "pre-existing" error mentions ───────────────────
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    PATTERNS=(
        "pre-existing"
        "pre existing"
        "preexisting error"
        "existing error.*not.*fix"
        "skipping.*error"
        "ignoring.*error"
        "outside.*scope.*error"
    )
    for pattern in "${PATTERNS[@]}"; do
        if grep -qiP "$pattern" "$TRANSCRIPT_PATH" 2>/dev/null; then
            ISSUES+=("Agent transcript contains references to unfixed errors (matched: '$pattern'). Please go back and fix ALL errors, including pre-existing ones.")
            break
        fi
    done
fi

# ── 2. Run Go compilation check ────────────────────────────────────────────
if [ -f "$WORKSPACE_ROOT/go.mod" ] && command -v go &>/dev/null; then
    GO_VET_OUTPUT=""
    if ! GO_VET_OUTPUT=$(cd "$WORKSPACE_ROOT" && go vet ./pkg/... 2>&1); then
        if [ -n "$GO_VET_OUTPUT" ]; then
            ISSUES+=("Go vet found errors:\n$GO_VET_OUTPUT")
        fi
    fi
fi

# ── 3. Run frontend TypeScript check ───────────────────────────────────────
FRONTEND_DIR="$WORKSPACE_ROOT/frontend"
if [ -f "$FRONTEND_DIR/tsconfig.json" ] && command -v npx &>/dev/null; then
    TSC_OUTPUT=""
    if ! TSC_OUTPUT=$(cd "$FRONTEND_DIR" && npx tsc --noEmit 2>&1 | head -30); then
        if [ -n "$TSC_OUTPUT" ]; then
            ISSUES+=("TypeScript compilation errors:\n$TSC_OUTPUT")
        fi
    fi
fi

# ── Decide whether to block ────────────────────────────────────────────────
if [ ${#ISSUES[@]} -gt 0 ]; then
    REASON="STOP HOOK: Found ${#ISSUES[@]} issue(s) that must be fixed before the session ends:\n\n"
    for issue in "${ISSUES[@]}"; do
        REASON+="- $issue\n\n"
    done
    REASON+="Please fix all issues above before finishing. Per project rules: always fix any errors you find, even pre-existing ones."

    if command -v jq &>/dev/null; then
        jq -n \
            --arg reason "$REASON" \
            '{hookSpecificOutput: {hookEventName: "Stop", decision: "block", reason: $reason}}'
    else
        # Manual JSON construction (escape newlines and quotes)
        ESCAPED_REASON=$(echo -e "$REASON" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
        echo "{\"hookSpecificOutput\":{\"hookEventName\":\"Stop\",\"decision\":\"block\",\"reason\":\"$ESCAPED_REASON\"}}"
    fi
    exit 0
fi

# No issues — allow the agent to stop
exit 0
