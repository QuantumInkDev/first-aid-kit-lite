#Requires -Version 5.1
<#
.SYNOPSIS
    Clears Windows Event Viewer logs.

.DESCRIPTION
    This script clears the major Windows Event Logs including Application,
    System, and Security logs. It creates backups before clearing for safety.

    WARNING: This will clear event logs which may be needed for troubleshooting.
    Only run this if you are certain you don't need the current log data.

.NOTES
    Name: clear-event-logs.ps1
    Author: First Aid Kit Lite
    Version: 1.0.0
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

Write-Output "=== Clear Event Logs ==="
Write-Output "Started at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output ""

# Create backup directory
$backupDir = "$env:TEMP\EventLogBackups_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$createBackup = $true

$clearedLogs = @()
$skippedLogs = @()
$errors = @()

try {
    # Define critical logs to clear
    $logsToProcess = @(
        @{Name = "Application"; DisplayName = "Application"},
        @{Name = "System"; DisplayName = "System"},
        @{Name = "Security"; DisplayName = "Security"},
        @{Name = "Setup"; DisplayName = "Setup"},
        @{Name = "Microsoft-Windows-Store/Operational"; DisplayName = "Windows Store"}
    )

    Write-Output "[INFO] Event logs to process: $($logsToProcess.Count)"
    Write-Output ""

    # Create backup directory if backup is enabled
    if ($createBackup) {
        try {
            Write-Output "[INFO] Creating backup directory: $backupDir"
            New-Item -Path $backupDir -ItemType Directory -Force -ErrorAction Stop | Out-Null
            Write-Output "[OK] Backup directory created"
            Write-Output ""
        }
        catch {
            Write-Output "[WARN] Could not create backup directory: $_"
            Write-Output "[INFO] Proceeding without backup..."
            $createBackup = $false
            Write-Output ""
        }
    }

    foreach ($logInfo in $logsToProcess) {
        $logName = $logInfo.Name
        $displayName = $logInfo.DisplayName

        Write-Output "[INFO] Processing: $displayName"

        try {
            # Get log information
            $log = Get-WinEvent -ListLog $logName -ErrorAction Stop
            $recordCount = $log.RecordCount

            if ($null -eq $recordCount -or $recordCount -eq 0) {
                Write-Output "[SKIP] $displayName - No records to clear"
                $skippedLogs += @{
                    Log = $displayName
                    Reason = "Empty"
                    Records = 0
                }
                Write-Output ""
                continue
            }

            Write-Output "[INFO] Current records: $recordCount"

            # Create backup if enabled
            if ($createBackup) {
                try {
                    $backupFile = Join-Path $backupDir "$($logName -replace '/','_').evtx"
                    Write-Output "[INFO] Creating backup: $backupFile"

                    wevtutil epl $logName $backupFile

                    if (Test-Path $backupFile) {
                        $backupSize = [math]::Round((Get-Item $backupFile).Length / 1KB, 2)
                        Write-Output "[OK] Backup created: $backupSize KB"
                    }
                }
                catch {
                    Write-Output "[WARN] Backup failed: $_"
                    Write-Output "[INFO] Continuing without backup for this log..."
                }
            }

            # Clear the event log
            Write-Output "[INFO] Clearing log..."
            wevtutil cl $logName

            if ($LASTEXITCODE -eq 0) {
                Write-Output "[OK] $displayName cleared successfully"
                $clearedLogs += @{
                    Log = $displayName
                    RecordsCleared = $recordCount
                }
            }
            else {
                throw "wevtutil returned exit code $LASTEXITCODE"
            }
        }
        catch {
            $errorMsg = $_.Exception.Message
            $errors += "$displayName`: $errorMsg"
            Write-Output "[ERROR] Failed to clear $displayName`: $errorMsg"

            $skippedLogs += @{
                Log = $displayName
                Reason = "Error: $errorMsg"
                Records = if ($recordCount) { $recordCount } else { 0 }
            }
        }

        Write-Output ""
    }

    # Summary
    Write-Output "=== Summary ==="
    Write-Output "Logs processed: $($logsToProcess.Count)"
    Write-Output "Successfully cleared: $($clearedLogs.Count)"
    Write-Output "Skipped/Failed: $($skippedLogs.Count)"
    Write-Output ""

    if ($clearedLogs.Count -gt 0) {
        Write-Output "Cleared logs:"
        $totalRecordsCleared = 0
        foreach ($log in $clearedLogs) {
            Write-Output "  - $($log.Log): $($log.RecordsCleared) records"
            $totalRecordsCleared += $log.RecordsCleared
        }
        Write-Output ""
        Write-Output "Total records cleared: $totalRecordsCleared"
        Write-Output ""
    }

    if ($skippedLogs.Count -gt 0) {
        Write-Output "Skipped logs:"
        foreach ($log in $skippedLogs) {
            Write-Output "  - $($log.Log): $($log.Reason)"
        }
        Write-Output ""
    }

    if ($createBackup -and (Test-Path $backupDir)) {
        $backupFiles = Get-ChildItem -Path $backupDir -File -ErrorAction SilentlyContinue
        if ($null -ne $backupFiles -and ($backupFiles | Measure-Object).Count -gt 0) {
            $totalBackupSize = [math]::Round(($backupFiles | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
            Write-Output "Backup location: $backupDir"
            Write-Output "Backup size: $totalBackupSize MB"
            Write-Output "Backup files: $($backupFiles.Count)"
            Write-Output ""
        }
    }

    if ($errors.Count -gt 0) {
        Write-Output "Errors encountered: $($errors.Count)"
        foreach ($error in $errors) {
            Write-Output "  - $error"
        }
        Write-Output ""
    }

    Write-Output "NOTE: Event logs will begin recording new events immediately"
    Write-Output ""
    Write-Output "Completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

    if ($clearedLogs.Count -gt 0) {
        Write-Output "Status: SUCCESS"
        exit 0
    }
    elseif ($errors.Count -eq $logsToProcess.Count) {
        Write-Output "Status: FAILED"
        exit 1
    }
    else {
        Write-Output "Status: PARTIAL SUCCESS"
        exit 0
    }
}
catch {
    Write-Output "[ERROR] Event log clearing failed: $_"
    Write-Output "Status: FAILED"
    exit 1
}
