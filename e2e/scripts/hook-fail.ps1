# Fails intentionally to test pre-connect abort behavior.

Write-Output "hook-fail.ps1 running"
Write-Error "hook-fail.ps1 failing"
exit 1
