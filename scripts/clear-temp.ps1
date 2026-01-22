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
    Author: Justin Garcia, Horizon BCBSNJ
    Version: 1.0.0
#>

[CmdletBinding()]
param()

## House Keeping -------------------------------------------------------------------------------------#
Remove-Variable * -ErrorAction SilentlyContinue; Remove-Module *; $Error.Clear() | Out-Null; Clear-Host

# Error handling -------------------------------------------------------------------------------------#
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Varibles -------------------------------------------------------------------------------------------#
$totalFilesDeleted = 0
$totalSpaceFreed = 0
$Errors = @()

Write-Output "=== Clear Temporary Files ===" 
Write-Output "[INFO] Started at: $(Get-Date -Format 'MM-dd-yyyy hh:mmtt')"
Write-Output ""

# Functions ------------------------------------------------------------------------------------------#
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
        Write-Output " "
    }
    catch {
        $script:errors += "Failed to clean $Description`: $_"
        Write-Output "[ERROR] $Description - $_"
    }
}

# Clean C Temp
Try {
    
    Remove-TempFiles -Path "C:\\Temp" -Description "C:\Temp"
}
Catch {
    #
}
# Clean Windows Temp
Remove-TempFiles -Path "$env:SystemRoot\Temp" -Description "Windows\Temp"

# Clean User Tmp
Remove-TempFiles -Path "$env:TMP" -Description "UserEnvironment %TMP%"

# Clean User Temp
Remove-TempFiles -Path "$env:TEMP" -Description "UserEnvironment %Temp%"

# Clean Recent Items
Remove-TempFiles -Path "$env:APPDATA\Microsoft\Windows\Recent" -Description "Recent Items"

# Clean Temporary Internet Files
Remove-TempFiles -Path "$env:LOCALAPPDATA\Microsoft\Windows\Temporary Internet Files" -Description "Temporary Internet Files"

# Clean Edge Cache Files
Remove-TempFiles -Path "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache" -Description "Edge Cache Files"

# Clean Chrome Cache Files
Remove-TempFiles -Path "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache" -Description "Chrome Cache Files"

# Clean Java Cache Files
Remove-TempFiles -Path "$env:USERPROFILE\AppData\LocalLow\Sun\Java" -Description "Java Cache Files"

# Clean Windows Prefetch (if accessible)
try {
    if (Test-Path "$env:SystemRoot\Prefetch") {
        Remove-TempFiles -Path "$env:SystemRoot\Prefetch" -Description "Windows Prefetch"
    }
} 
catch {
    #
}

# Clean Windows Update Cache
# try {
#     if (Test-Path "$env:SystemRoot\SoftwareDistribution\Download") {
#         Remove-TempFiles -Path "$env:SystemRoot\SoftwareDistribution\Download" -Description "Windows Update Cache"
#     }
# } 
# catch {
#     #
# }

# Clean Thumbnail Cache
try {
    if (Test-Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer") {
        Remove-TempFiles -Path "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db" -Description "Thumbnail Cache DB"
    }
} 
catch {
    #
}
# Output ---------------------------------------------------------------------------------------------#
# Summary
Write-Output ""
Write-Output "=== Summary ==="
Write-Output "Total files deleted: $totalFilesDeleted"
Write-Output "Total space freed: $([math]::Round($totalSpaceFreed / 1MB, 2)) MB ($([math]::Round($totalSpaceFreed / 1GB, 2)) GB)"

if ($errors.Count -gt 0) {
    Write-Output ""
    Write-Output "Errors encountered: $($errors.Count)"
    foreach ($errorr in $errors) {
        Write-Output "  - $errorr"
    }
}

Write-Output ""
Write-Output "Completed at: $(Get-Date -Format 'MM-dd-yyyy hh:mm:ss tt')"
Write-Output "Status: SUCCESS"

# Return success
exit 0
