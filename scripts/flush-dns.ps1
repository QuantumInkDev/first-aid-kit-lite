#Requires -Version 5.1
<#
.SYNOPSIS
    Flushes the DNS resolver cache to fix network issues.

.DESCRIPTION
    This script clears the DNS resolver cache, which can help resolve
    issues with website access, incorrect IP resolution, or stale DNS entries.

.NOTES
    Name: flush-dns.ps1
    Author: First Aid Kit Lite
    Version: 1.0.0
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Output "=== Flush DNS Cache ==="
Write-Output "Started at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output ""

try {
    # Get DNS cache statistics before flush
    Write-Output "[INFO] Gathering DNS cache statistics..."
    $cacheBefore = Get-DnsClientCache -ErrorAction SilentlyContinue | Measure-Object
    $entriesBefore = if ($cacheBefore) { $cacheBefore.Count } else { 0 }
    Write-Output "[INFO] Current DNS cache entries: $entriesBefore"
    Write-Output ""

    # Flush DNS cache
    Write-Output "[INFO] Flushing DNS resolver cache..."
    Clear-DnsClientCache
    Write-Output "[OK] DNS cache flushed successfully"
    Write-Output ""

    # Verify cache was cleared
    $cacheAfter = Get-DnsClientCache -ErrorAction SilentlyContinue | Measure-Object
    $entriesAfter = if ($cacheAfter) { $cacheAfter.Count } else { 0 }

    Write-Output "=== Summary ==="
    Write-Output "Entries before: $entriesBefore"
    Write-Output "Entries after: $entriesAfter"
    Write-Output "Entries cleared: $($entriesBefore - $entriesAfter)"
    Write-Output ""
    Write-Output "Completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Output "Status: SUCCESS"

    exit 0
}
catch {
    Write-Output "[ERROR] Failed to flush DNS cache: $_"
    Write-Output "Status: FAILED"
    exit 1
}
