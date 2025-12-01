#Requires -Version 5.1
<#
.SYNOPSIS
    Clears Windows temporary files to free up disk space.

.DESCRIPTION
    This script safely removes temporary files from Windows temp directories,
    user temp folders, and browser caches. It includes error handling and
    reports the amount of space freed.

.NOTES
    Name: clear-temp.ps1
    Author: First Aid Kit Lite
    Version: 1.0.0
#>

[CmdletBinding()]
param()

# Error handling
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Initialize counters
$totalFilesDeleted = 0
$totalSpaceFreed = 0
$errors = @()

Write-Output "=== Clear Temporary Files ===" Write-Output "Started at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output ""

# Function to safely remove files
function Remove-TempFiles {
    param(
        [string]$Path,
        [string]$Description
    )

    if (-not (Test-Path $Path)) {
        Write-Output "[SKIP] $Description - Path does not exist: $Path"
        return
    }

    Write-Output "[INFO] Cleaning $Description..."

    try {
        $items = Get-ChildItem -Path $Path -Recurse -Force -ErrorAction SilentlyContinue
        $fileCount = 0
        $spaceFreed = 0

        foreach ($item in $items) {
            try {
                $size = 0
                if (-not $item.PSIsContainer) {
                    $size = $item.Length
                }

                Remove-Item -Path $item.FullName -Force -Recurse -ErrorAction Stop

                if (-not $item.PSIsContainer) {
                    $fileCount++
                    $spaceFreed += $size
                }
            }
            catch {
                # Silently skip files in use
            }
        }

        $script:totalFilesDeleted += $fileCount
        $script:totalSpaceFreed += $spaceFreed

        $spaceMB = [math]::Round($spaceFreed / 1MB, 2)
        Write-Output "[OK] $Description - Deleted $fileCount files, freed $spaceMB MB"
    }
    catch {
        $script:errors += "Failed to clean $Description`: $_"
        Write-Output "[ERROR] $Description - $_"
    }
}

# Clean C Temp
Remove-TempFiles -Path "C:\Temp" -Description "Windows Temp"

# Clean Windows Temp
Remove-TempFiles -Path "$env:SystemRoot\Temp" -Description "Windows Temp"

# Clean User Temp
Remove-TempFiles -Path "$env:TEMP" -Description "User Temp"

# Clean Windows Prefetch (if accessible)
if (Test-Path "$env:SystemRoot\Prefetch") {
    Remove-TempFiles -Path "$env:SystemRoot\Prefetch" -Description "Windows Prefetch"
}

# Clean Recent Items
Remove-TempFiles -Path "$env:APPDATA\Microsoft\Windows\Recent" -Description "Recent Items"

# Clean Windows Update Cache
if (Test-Path "$env:SystemRoot\SoftwareDistribution\Download") {
    Remove-TempFiles -Path "$env:SystemRoot\SoftwareDistribution\Download" -Description "Windows Update Cache"
}

# Clean Delivery Optimization Files
if (Test-Path "$env:SystemRoot\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache") {
    Remove-TempFiles -Path "$env:SystemRoot\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache" -Description "Delivery Optimization"
}

# Clean Thumbnail Cache
if (Test-Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer") {
    Remove-TempFiles -Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db" -Description "Thumbnail Cache"
}

# Summary
Write-Output ""
Write-Output "=== Summary ==="
Write-Output "Total files deleted: $totalFilesDeleted"
Write-Output "Total space freed: $([math]::Round($totalSpaceFreed / 1MB, 2)) MB ($([math]::Round($totalSpaceFreed / 1GB, 2)) GB)"

if ($errors.Count -gt 0) {
    Write-Output ""
    Write-Output "Errors encountered: $($errors.Count)"
    foreach ($error in $errors) {
        Write-Output "  - $error"
    }
}

Write-Output ""
Write-Output "Completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "Status: SUCCESS"

# Return success
exit 0
