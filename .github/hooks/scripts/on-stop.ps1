#!/usr/bin/env pwsh
<#
.SYNOPSIS
    VS Code Copilot agent Stop hook — checks for unresolved pre-existing errors
    and runs compile/lint validation before allowing the agent to stop.

.DESCRIPTION
    This script is invoked by the VS Code Copilot agent Stop hook.
    It receives JSON on stdin with session metadata including:
      - stop_hook_active: boolean (true if already re-running after a previous block)
      - transcript_path: path to the conversation transcript JSON

    The script:
      1. Prevents infinite loops by allowing stop if stop_hook_active is true
      2. Reads the conversation transcript and checks if the agent mentioned
         "pre-existing" errors without fixing them
      3. Runs go vet and TypeScript compilation checks
      4. Outputs JSON to block the stop if issues are found, with a reason
         telling the agent what to fix
#>

$ErrorActionPreference = 'Stop'

# ── Read hook input from stdin ──────────────────────────────────────────────
$rawInput = $null
try {
    $rawInput = [Console]::In.ReadToEnd()
} catch {
    # If stdin is empty/unavailable, allow the stop
    exit 0
}

if (-not $rawInput) {
    exit 0
}

$hookInput = $null
try {
    $hookInput = $rawInput | ConvertFrom-Json
} catch {
    # Malformed input, allow the stop
    exit 0
}

# ── Guard: prevent infinite loops ───────────────────────────────────────────
# If the agent is already continuing from a previous stop-hook block, let it go.
if ($hookInput.stop_hook_active -eq $true) {
    exit 0
}

# ── Resolve workspace root ──────────────────────────────────────────────────
$workspaceRoot = if ($hookInput.cwd) { $hookInput.cwd } else { Get-Location }

# ── Collect issues ──────────────────────────────────────────────────────────
$issues = [System.Collections.Generic.List[string]]::new()

# ── 1. Check transcript for "pre-existing" error mentions ───────────────────
if ($hookInput.transcript_path -and (Test-Path $hookInput.transcript_path)) {
    try {
        $transcriptRaw = Get-Content -Path $hookInput.transcript_path -Raw -ErrorAction Stop
        # Search for "pre-existing" (case-insensitive) in the last portion of the transcript
        # This catches when the agent acknowledges errors but doesn't fix them
        $patterns = @(
            'pre-existing',
            'pre existing',
            'preexisting error',
            'existing error.*not.*fix',
            'skipping.*error',
            'ignoring.*error',
            'outside.*scope.*error'
        )
        foreach ($pattern in $patterns) {
            if ($transcriptRaw -match $pattern) {
                $issues.Add("Agent transcript contains references to unfixed errors (matched: '$pattern'). Please go back and fix ALL errors, including pre-existing ones.")
                break
            }
        }
    } catch {
        # If we can't read the transcript, don't block on this check
    }
}

# ── 2. Run Go compilation check ────────────────────────────────────────────
$goModPath = Join-Path $workspaceRoot 'go.mod'
if (Test-Path $goModPath) {
    try {
        Push-Location $workspaceRoot
        $goVetOutput = & go vet ./pkg/... 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0 -and $goVetOutput.Trim()) {
            $issues.Add("Go vet found errors:`n$goVetOutput")
        }
    } catch {
        # go vet not available or failed to run — don't block
    } finally {
        Pop-Location
    }
}

# ── 3. Run frontend TypeScript / lint check ─────────────────────────────────
$frontendDir = Join-Path $workspaceRoot 'frontend'
$tsconfigPath = Join-Path $frontendDir 'tsconfig.json'
if (Test-Path $tsconfigPath) {
    try {
        Push-Location $frontendDir
        # Quick TypeScript type-check (no emit)
        $npxPath = Get-Command npx -ErrorAction SilentlyContinue
        if ($npxPath) {
            $tscOutput = & npx tsc --noEmit 2>&1 | Out-String
            if ($LASTEXITCODE -ne 0 -and $tscOutput.Trim()) {
                # Limit output to first 30 lines to avoid overwhelming the agent
                $lines = $tscOutput -split "`n" | Select-Object -First 30
                $truncated = $lines -join "`n"
                $issues.Add("TypeScript compilation errors:`n$truncated")
            }
        }
    } catch {
        # tsc not available or failed — don't block
    } finally {
        Pop-Location
    }
}

# ── Decide whether to block ────────────────────────────────────────────────
if ($issues.Count -gt 0) {
    $reason = "STOP HOOK: Found $($issues.Count) issue(s) that must be fixed before the session ends:`n`n"
    $reason += ($issues | ForEach-Object { "- $_" }) -join "`n`n"
    $reason += "`n`nPlease fix all issues above before finishing. Per project rules: always fix any errors you find, even pre-existing ones."

    $output = @{
        hookSpecificOutput = @{
            hookEventName = "Stop"
            decision      = "block"
            reason        = $reason
        }
    } | ConvertTo-Json -Depth 5

    Write-Output $output
    exit 0
}

# No issues found — allow the agent to stop
exit 0
