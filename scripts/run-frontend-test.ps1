$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
  [Parameter(Mandatory = $true)]
  [string]$TestPath,

  [Parameter()]
  [string]$OutputPath = 'frontend/test-results.txt'
)

try {
  npm --prefix frontend test -- --runTestsByPath $TestPath --verbose 2>&1 | Tee-Object -FilePath $OutputPath
  if ($LASTEXITCODE -ne 0) {
    throw "npm test exited with code $LASTEXITCODE"
  }
} catch {
  Write-Error "Frontend test failed: $($_.Exception.Message)"
  exit 1
}
