#Requires -Version 5.1
<#
.SYNOPSIS
    Clears Windows Prefetch data to improve system performance.

.DESCRIPTION
    This script removes prefetch files from the Windows Prefetch directory.
    Prefetch files are used by Windows to speed up application launches, but
    can become corrupted or outdated. Clearing them can help resolve startup
    issues and improve performance.

.NOTES
    Name: clean-prefetch.ps1
    Author: First Aid Kit Lite
    Version: 1.0.0
    Risk Level: Low
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

Write-Output "=== Clean Prefetch Data ==="
Write-Output "Started at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output ""

# Initialize counters
$filesDeleted = 0
$spaceFreed = 0
$errors = @()

try {
    $prefetchPath = "$env:SystemRoot\Prefetch"

    # Check if Prefetch directory exists
    if (-not (Test-Path $prefetchPath)) {
        Write-Output "[WARN] Prefetch directory not found: $prefetchPath"
        Write-Output "[INFO] Prefetch may be disabled on this system"
        Write-Output ""
        Write-Output "=== Summary ==="
        Write-Output "Status: Prefetch not available"
        Write-Output ""
        Write-Output "Completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        Write-Output "Status: SUCCESS"
        exit 0
    }

    Write-Output "[INFO] Analyzing Prefetch directory..."

    # Get all prefetch files
    $prefetchFiles = Get-ChildItem -Path $prefetchPath -Filter "*.pf" -File -ErrorAction SilentlyContinue

    if ($null -eq $prefetchFiles -or $prefetchFiles.Count -eq 0) {
        Write-Output "[INFO] No prefetch files found to clean"
    }
    else {
        $totalFiles = ($prefetchFiles | Measure-Object).Count
        $totalSize = ($prefetchFiles | Measure-Object -Property Length -Sum).Sum

        Write-Output "[INFO] Found $totalFiles prefetch files"
        Write-Output "[INFO] Total size: $([math]::Round($totalSize / 1MB, 2)) MB"
        Write-Output ""
        Write-Output "[INFO] Deleting prefetch files..."

        foreach ($file in $prefetchFiles) {
            try {
                $fileSize = $file.Length
                Remove-Item -Path $file.FullName -Force -ErrorAction Stop
                $filesDeleted++
                $spaceFreed += $fileSize
            }
            catch {
                $errors += "Failed to delete $($file.Name): $_"
                Write-Output "[WARN] Could not delete: $($file.Name)"
            }
        }

        Write-Output "[OK] Deleted $filesDeleted of $totalFiles files"
    }

    # Clean Layout.ini if it exists
    $layoutFile = Join-Path $prefetchPath "Layout.ini"
    if (Test-Path $layoutFile) {
        try {
            $layoutSize = (Get-Item $layoutFile).Length
            Remove-Item -Path $layoutFile -Force -ErrorAction Stop
            $filesDeleted++
            $spaceFreed += $layoutSize
            Write-Output "[OK] Deleted Layout.ini"
        }
        catch {
            Write-Output "[WARN] Could not delete Layout.ini: $_"
        }
    }

    # Clean ReadyBoot directory if it exists
    $readyBootPath = Join-Path $prefetchPath "ReadyBoot"
    if (Test-Path $readyBootPath) {
        try {
            Write-Output "[INFO] Cleaning ReadyBoot directory..."
            $readyBootFiles = Get-ChildItem -Path $readyBootPath -Recurse -Force -ErrorAction SilentlyContinue

            foreach ($file in $readyBootFiles) {
                try {
                    if (-not $file.PSIsContainer) {
                        $fileSize = $file.Length
                        Remove-Item -Path $file.FullName -Force -ErrorAction Stop
                        $filesDeleted++
                        $spaceFreed += $fileSize
                    }
                }
                catch {
                    # Silently skip files in use
                }
            }
            Write-Output "[OK] ReadyBoot directory cleaned"
        }
        catch {
            Write-Output "[WARN] Could not clean ReadyBoot: $_"
        }
    }

    Write-Output ""
    Write-Output "=== Summary ==="
    Write-Output "Files deleted: $filesDeleted"
    Write-Output "Space freed: $([math]::Round($spaceFreed / 1MB, 2)) MB"

    if ($errors.Count -gt 0) {
        Write-Output ""
        Write-Output "Errors encountered: $($errors.Count)"
        foreach ($error in $errors) {
            Write-Output "  - $error"
        }
    }

    Write-Output ""
    Write-Output "NOTE: Windows will rebuild prefetch data automatically"
    Write-Output "      First application launches may be slightly slower"
    Write-Output ""
    Write-Output "Completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Output "Status: SUCCESS"

    exit 0
}
catch {
    Write-Output "[ERROR] Failed to clean prefetch data: $_"
    Write-Output "Status: FAILED"
    exit 1
}
