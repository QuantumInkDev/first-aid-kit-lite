#Requires -Version 5.1
<#
.SYNOPSIS
    Optimizes and defragments all system drives.

.DESCRIPTION
    This script runs drive optimization on all available volumes.
    For SSDs, it performs TRIM operations.
    For HDDs, it performs defragmentation.
    The script automatically detects drive types and applies appropriate optimization.

.NOTES
    Name: optimize-drives.ps1
    Author: First Aid Kit Lite
    Version: 1.0.0
    Note: This operation may take a considerable amount of time
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

Write-Output "=== Optimize Drives ==="
Write-Output "Started at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output ""

$optimizedDrives = @()
$skippedDrives = @()
$errors = @()

try {
    # Get all fixed drives
    Write-Output "[INFO] Detecting available drives..."
    $volumes = Get-Volume | Where-Object {
        $_.DriveType -eq 'Fixed' -and
        $_.DriveLetter -ne $null -and
        $_.FileSystem -in @('NTFS', 'ReFS')
    }

    if ($null -eq $volumes -or ($volumes | Measure-Object).Count -eq 0) {
        Write-Output "[WARN] No eligible drives found for optimization"
        Write-Output ""
        Write-Output "=== Summary ==="
        Write-Output "Status: No drives to optimize"
        Write-Output ""
        Write-Output "Completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        Write-Output "Status: SUCCESS"
        exit 0
    }

    $driveCount = ($volumes | Measure-Object).Count
    Write-Output "[INFO] Found $driveCount drive(s) to analyze"
    Write-Output ""

    foreach ($volume in $volumes) {
        $driveLetter = $volume.DriveLetter
        $driveLabel = if ($volume.FileSystemLabel) { $volume.FileSystemLabel } else { "Unlabeled" }

        Write-Output "=== Drive $($driveLetter): ($driveLabel) ==="

        try {
            # Get drive information
            $partition = Get-Partition -DriveLetter $driveLetter -ErrorAction SilentlyContinue
            $disk = $null
            $mediaType = "Unknown"

            if ($null -ne $partition) {
                $disk = Get-Disk -Number $partition.DiskNumber -ErrorAction SilentlyContinue
                if ($null -ne $disk) {
                    $mediaType = $disk.MediaType
                }
            }

            Write-Output "[INFO] Drive type: $mediaType"
            Write-Output "[INFO] Size: $([math]::Round($volume.Size / 1GB, 2)) GB"
            Write-Output "[INFO] Free space: $([math]::Round($volume.SizeRemaining / 1GB, 2)) GB"

            # Check if drive needs optimization
            $analysisResult = Optimize-Volume -DriveLetter $driveLetter -Analyze -Verbose 4>&1

            # Determine optimization type based on media type
            $optimizationType = switch ($mediaType) {
                "SSD" { "TRIM/Retrim" }
                "HDD" { "Defragment" }
                default { "Standard optimization" }
            }

            Write-Output "[INFO] Running $optimizationType..."

            # Optimize the volume
            $startTime = Get-Date

            if ($mediaType -eq "SSD") {
                # For SSDs, use ReTrim
                Optimize-Volume -DriveLetter $driveLetter -ReTrim -ErrorAction Stop
            }
            else {
                # For HDDs and unknown types, use defragmentation
                Optimize-Volume -DriveLetter $driveLetter -Defrag -ErrorAction Stop
            }

            $duration = (Get-Date) - $startTime
            $durationSeconds = [math]::Round($duration.TotalSeconds, 1)

            Write-Output "[OK] Drive $($driveLetter): optimized successfully in $durationSeconds seconds"

            $optimizedDrives += @{
                Drive = $driveLetter
                Label = $driveLabel
                Type = $mediaType
                Operation = $optimizationType
                Duration = $durationSeconds
            }
        }
        catch {
            $errorMsg = $_.Exception.Message
            $errors += "Drive $($driveLetter): $errorMsg"
            Write-Output "[ERROR] Failed to optimize drive $($driveLetter): $errorMsg"

            $skippedDrives += @{
                Drive = $driveLetter
                Label = $driveLabel
                Reason = $errorMsg
            }
        }

        Write-Output ""
    }

    # Summary
    Write-Output "=== Summary ==="
    Write-Output "Total drives analyzed: $driveCount"
    Write-Output "Successfully optimized: $($optimizedDrives.Count)"
    Write-Output "Skipped/Failed: $($skippedDrives.Count)"
    Write-Output ""

    if ($optimizedDrives.Count -gt 0) {
        Write-Output "Optimized drives:"
        foreach ($drive in $optimizedDrives) {
            Write-Output "  - Drive $($drive.Drive): ($($drive.Label)) - $($drive.Operation) - $($drive.Duration)s"
        }
        Write-Output ""
    }

    if ($skippedDrives.Count -gt 0) {
        Write-Output "Skipped drives:"
        foreach ($drive in $skippedDrives) {
            Write-Output "  - Drive $($drive.Drive): ($($drive.Label)) - $($drive.Reason)"
        }
        Write-Output ""
    }

    if ($errors.Count -gt 0) {
        Write-Output "Errors encountered: $($errors.Count)"
        foreach ($error in $errors) {
            Write-Output "  - $error"
        }
        Write-Output ""
    }

    Write-Output "Completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

    if ($optimizedDrives.Count -gt 0) {
        Write-Output "Status: SUCCESS"
        exit 0
    }
    elseif ($errors.Count -eq $driveCount) {
        Write-Output "Status: FAILED"
        exit 1
    }
    else {
        Write-Output "Status: PARTIAL SUCCESS"
        exit 0
    }
}
catch {
    Write-Output "[ERROR] Drive optimization failed: $_"
    Write-Output "Status: FAILED"
    exit 1
}
