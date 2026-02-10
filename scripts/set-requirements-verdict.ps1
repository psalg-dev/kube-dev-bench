<#
.SYNOPSIS
Records a requirements review verdict.

.DESCRIPTION
Writes a structured requirements verdict record to a JSON file so review
sessions have a consistent, durable output. The default output location is
agent-dashboard/requirements-verdict.json at the repository root.

.PARAMETER Verdict
The review verdict. Valid values are Pass or Fail.

.PARAMETER Reason
Optional reasoning or context for the verdict.

.PARAMETER OutputPath
Optional override for the output JSON file path.

.PARAMETER PassThru
Outputs the verdict object to the pipeline when specified.

.EXAMPLE
.\scripts\set-requirements-verdict.ps1 -Verdict Pass -Reason "All checks complete"

.OUTPUTS
System.Management.Automation.PSCustomObject when -PassThru is specified.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Pass', 'Fail')]
    [string]$Verdict,

    [Parameter()]
    [string]$Reason = '',

    [Parameter()]
    [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'agent-dashboard\requirements-verdict.json'),

    [Parameter()]
    [switch]$PassThru
)

$ErrorActionPreference = 'Stop'

$timestamp = (Get-Date).ToString('o')
$record = [PSCustomObject]@{
    verdict   = $Verdict
    reason    = $Reason
    timestamp = $timestamp
}

$directory = Split-Path -Parent $OutputPath
if (-not (Test-Path -Path $directory)) {
    New-Item -Path $directory -ItemType Directory -Force | Out-Null
}

$record | ConvertTo-Json -Depth 4 | Set-Content -Path $OutputPath -Encoding UTF8

if ($PassThru.IsPresent) {
    Write-Output $record
}
