<#
Parses Go coverage profile (coverage/go-coverage) and frontend lcov summary CSV
and produces combined coverage summary plus per-file and per-function reports.
#>
Set-StrictMode -Version Latest
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $root
$covDir = Join-Path $root '..\coverage' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $covDir) { $covDir = Join-Path $root '..\coverage' }
$covDir = (Get-Item $covDir).FullName
$goProfile = Join-Path $covDir 'go-coverage'
if (-not (Test-Path $goProfile)) { $goProfile = Join-Path $covDir 'go-coverage.out' }
if (-not (Test-Path $goProfile)) { Write-Error "Go coverage profile not found at $goProfile"; exit 1 }

# Parse go profile
$lines = Get-Content $goProfile | Where-Object { $_ -and ($_ -notmatch '^mode:') }
$goTotalFound = 0
$goTotalHit = 0
$goFiles = @{}
foreach ($l in $lines) {
    $cols = $l -split '\s+' | Where-Object { $_ -ne '' }
    if ($cols.Length -lt 3) { continue }
    $fileRange = $cols[0]
    $num = [int]$cols[1]
    $count = [int]$cols[2]
    # file is everything before the first ':' in fileRange
    $file = $fileRange -replace '(:).*$', ''
    if (-not $goFiles.ContainsKey($file)) { $goFiles[$file] = @{Found=0;Hit=0} }
    $goFiles[$file].Found += $num
    if ($count -gt 0) { $goFiles[$file].Hit += $num }
    $goTotalFound += $num
    if ($count -gt 0) { $goTotalHit += $num }
}
if ($goTotalFound -eq 0) { $goPct = 0 } else { $goPct = ($goTotalHit / $goTotalFound) * 100 }

# Parse go function coverage (coverage/go-coverage-func.txt)
$goFuncFile = Join-Path $covDir 'go-coverage-func.txt'
$goFuncOut = Join-Path $covDir 'go-function-coverage.csv'
$funcRows = @()
if (Test-Path $goFuncFile) {
    $gflines = Get-Content $goFuncFile | Where-Object { $_ -and ($_ -notmatch '^\s*$') }
    foreach ($gl in $gflines) {
        if ($gl -match '^(.+?):\d+:\s*(.+?)\s+([0-9]+(?:\.[0-9]+)?)%$') {
            $file = $matches[1]
            $func = $matches[2]
            $pct = $matches[3]
            $funcRows += [PSCustomObject]@{File=$file; Function=$func; Percent=$pct}
        }
    }
    # write CSV
    $funcRows | Export-Csv -Path $goFuncOut -NoTypeInformation -Encoding UTF8
}

# Frontend summary CSV - prefer *_new.csv then fallback
$frontendCsvCandidates = @('frontend-lcov-summary-new.csv','frontend-lcov-summary.csv','frontend-lcov-summary-old.csv')
$frontendSrc = $null
foreach ($c in $frontendCsvCandidates) {
    $p = Join-Path $covDir $c
    if (Test-Path $p) { $frontendSrc = $p; break }
}
$frontendOut = Join-Path $covDir 'frontend-file-coverage.csv'
$frontendFound = 0
$frontendHit = 0
if ($frontendSrc) {
    Copy-Item -Path $frontendSrc -Destination $frontendOut -Force
    try {
        $csv = Import-Csv -Path $frontendSrc -Encoding UTF8
        $frontendFound = ($csv | Measure-Object -Property LinesFound -Sum).Sum
        $frontendHit = ($csv | Measure-Object -Property LinesHit -Sum).Sum
    } catch {
        Write-Host ("Warning: could not parse frontend CSV at {0}: {1}" -f $frontendSrc, $_)
    }
}
$frontendPct = if ($frontendFound -gt 0) { ($frontendHit / $frontendFound) * 100 } else { 0 }

# Combined
$combinedFound = $goTotalFound + $frontendFound
$combinedHit = $goTotalHit + $frontendHit
$combinedPct = if ($combinedFound -gt 0) { ($combinedHit / $combinedFound) * 100 } else { 0 }

# Write per-file go CSV
$goFileCsv = Join-Path $covDir 'go-file-coverage.csv'
$goFiles.GetEnumerator() | ForEach-Object {
    [PSCustomObject]@{
        File = $_.Key
        LinesFound = $_.Value.Found
        LinesHit = $_.Value.Hit
        LinesPct = if ($_.Value.Found -gt 0) { [math]::Round((($_.Value.Hit / $_.Value.Found) * 100),2) } else { 0 }
    }
} | Sort-Object -Property File | Export-Csv -Path $goFileCsv -NoTypeInformation -Encoding UTF8

# Summary output
$summary = @()
$summary += "Coverage summary generated: $(Get-Date -Format o)"
$summary += "Go: $([math]::Round($goPct,2))% ($goTotalHit/$goTotalFound) statements"
$summary += "Frontend: $([math]::Round($frontendPct,2))% ($frontendHit/$frontendFound) lines"
$summary += "Combined (weighted by lines): $([math]::Round($combinedPct,2))% ($combinedHit/$combinedFound)"
$summaryFile = Join-Path $covDir 'combined-coverage-summary.txt'
$summary | Out-File -FilePath $summaryFile -Encoding UTF8

Write-Host "Wrote: $summaryFile"
Write-Host "Wrote: $goFileCsv"
if (Test-Path $goFuncOut) { Write-Host "Wrote: $goFuncOut" }
if (Test-Path $frontendOut) { Write-Host "Wrote: $frontendOut (copied from $frontendSrc)" }

# Exit success
exit 0
