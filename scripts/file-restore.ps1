#Requires -Version 5.1
<#
.SYNOPSIS
    Restores user profile data from network backup with WPF progress dialog.

.DESCRIPTION
    Restores user profile data from a backup on \\virfsit1\share32 with verification,
    progress tracking, detailed summary reports, and email notification.
    Features WPF-based UI for smooth animations and modern appearance.
    Supports protocol URL for one-click restore from email links.

    V3.09 FIX: Timer-driven state machine replaces blocking robocopy loop
    - UI remains responsive during restore (elapsed timer updates properly)
    - Shows current file being restored
    - Fixed infinite loop bug with proper index capture

.PARAMETER Path
    Optional: Direct path to backup folder. If not provided, shows folder browser.

.PARAMETER WhatIf
    Dry run mode - shows what would be restored without making changes.

.PARAMETER Verbose
    Shows detailed debug logging in console output.

.PARAMETER SkipEmail
    Skip sending the email notification at the end.

.PARAMETER PromptForDeletion
    After restore completes, prompts the user to delete the backup folder.

.EXAMPLE
    .\file-restore.ps1
    Opens folder browser to select backup, then restores with confirmation.

.EXAMPLE
    .\file-restore.ps1 -WhatIf
    Shows what would be restored without copying.

.EXAMPLE
    .\file-restore.ps1 -Path "\\virfsit1\share32\WORKSTATION01_BU_2025-12-29"
    Restores from specified backup path directly.

.NOTES
    Name: file-restore.ps1
    Author: Justin Garcia, Horizon BCBSNJ
    Version: 3.09
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$Path,
    [switch]$SkipEmail,
    [switch]$PromptForDeletion
)

## House Keeping -------------------------------------------------------------------------------------#
# NOTE: Removed "Remove-Variable *" as it wipes out script parameters passed via command line
Remove-Module *; $Error.Clear() | Out-Null; Clear-Host

# Debug: Log the incoming parameters
Write-Host "[DEBUG] Script parameters received:" -ForegroundColor Yellow
Write-Host "  Path: '$Path'" -ForegroundColor Yellow
Write-Host "  SkipEmail: $SkipEmail" -ForegroundColor Yellow
Write-Host "  PromptForDeletion: $PromptForDeletion" -ForegroundColor Yellow

#region Configuration
# =============================================================================
# CONFIGURATION SECTION
# =============================================================================
# This section defines all script-level configuration variables used throughout
# the restore process. These settings control network paths, retry behavior,
# robocopy performance, and email notification settings.
#
# Key Settings:
# - NetworkSharePath: UNC path to the backup network share
# - RestoreVersion: Current script version for metadata tracking
# - MaxRetries/RetryDelaySeconds: Network access retry configuration
# - RobocopyThreads: Multi-threaded copy performance (default: 8 threads)
# - RobocopyTimeoutMinutes: Maximum time allowed per item restore
# =============================================================================
$script:NetworkSharePath = "\\virfsit1\share32"
$script:RestoreVersion = "3.09"
$script:MaxRetries = 5
$script:RetryDelaySeconds = 5
$script:RobocopyThreads = 8
$script:RobocopyTimeoutMinutes = 240

# Email Configuration
$script:EmailCC = "IT_Deployment@horizonblue.com"
$script:EmailBCC = ""  # Set this to add a BCC recipient

# Script-level variables
$script:LogFile = $null
$script:LogBuffer = [System.Collections.ArrayList]::new()
$script:BackedUpFiles = [System.Collections.ArrayList]::new()
$script:RestoreResults = @()
$script:StartTime = $null
$script:EndTime = $null
$script:Metadata = $null
#endregion

#region WPF Assemblies
# =============================================================================
# WPF ASSEMBLY IMPORTS
# =============================================================================
# Load .NET assemblies required for the WPF-based user interface.
# - PresentationFramework: Core WPF UI framework (Window, Button, Grid, etc.)
# - PresentationCore: WPF rendering and input system
# - WindowsBase: Threading and dispatcher for UI updates
# - System.Windows.Forms: Used for FolderBrowserDialog to select backup folder
# =============================================================================
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms
#endregion

#region Helper Functions
# =============================================================================
# HELPER FUNCTIONS
# =============================================================================
# Utility functions used throughout the restore script:
#
# Logging Functions:
# - Write-Log: Writes timestamped messages to console and log file
# - Write-LogSection: Writes section header dividers to log
# - Flush-LogBuffer: Flushes buffered log entries to disk
#
# Formatting Functions:
# - Format-Bytes: Converts bytes to human-readable format (KB, MB, GB, TB)
# - Format-TimeSpan: Formats TimeSpan as HH:MM:SS
#
# File/Folder Functions:
# - Get-PathSizeBytes: Calculates total size of a path
# - Get-PathStats: Returns file count, folder count, and total size
# - Ensure-Folder: Creates folder if it doesn't exist
#
# Network Functions:
# - Test-NetworkAccess: Tests network share accessibility with retries
# - Get-RobocopyStatus: Interprets robocopy exit codes
#
# Notification Functions:
# - Play-CompletionSound: Plays Windows notification sound
# - Send-RestoreNotificationEmail: Sends Outlook email with restore summary
# =============================================================================

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet('Info', 'Warning', 'Error', 'Success', 'Debug', 'Section', 'Skip')]
        [string]$Level = 'Info',
        [switch]$NoConsole,
        [switch]$NoFile
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd hh:mm:ss.fff tt"
    $prefix = switch ($Level) {
        'Info'    { "[INFO]    " }
        'Warning' { "[WARN]    " }
        'Error'   { "[ERROR]   " }
        'Success' { "[OK]      " }
        'Debug'   { "[DEBUG]   " }
        'Section' { "[=====]   " }
        'Skip'    { "[SKIP]    " }
    }

    $logMessage = "$timestamp $prefix$Message"

    if (-not $NoFile) {
        [void]$script:LogBuffer.Add($logMessage)
    }

    if ($script:LogFile -and -not $NoFile) {
        try {
            if ($script:LogBuffer.Count -gt 0) {
                $script:LogBuffer | ForEach-Object {
                    Add-Content -Path $script:LogFile -Value $_ -ErrorAction SilentlyContinue
                }
                $script:LogBuffer.Clear()
            }
        } catch { }
    }

    if (-not $NoConsole) {
        if ($Level -eq 'Debug' -and $VerbosePreference -ne 'Continue') { return }

        $color = switch ($Level) {
            'Info'    { 'White' }
            'Warning' { 'Yellow' }
            'Error'   { 'Red' }
            'Success' { 'Green' }
            'Debug'   { 'Gray' }
            'Section' { 'Cyan' }
            'Skip'    { 'DarkGray' }
        }
        Write-Host $logMessage -ForegroundColor $color
    }
}

function Write-LogSection {
    param([string]$Title)
    Write-Host ""
    Write-Log ("=" * 60) -Level Section
    Write-Log $Title.ToUpper() -Level Section
    Write-Log ("=" * 60) -Level Section
}

function Flush-LogBuffer {
    if ($script:LogFile -and $script:LogBuffer.Count -gt 0) {
        try {
            $script:LogBuffer | ForEach-Object {
                Add-Content -Path $script:LogFile -Value $_ -ErrorAction SilentlyContinue
            }
            $script:LogBuffer.Clear()
        } catch { }
    }
}

function Format-Bytes {
    param([long]$Bytes)

    if ($null -eq $Bytes -or $Bytes -eq 0) { return "0 B" }
    if ($Bytes -ge 1TB) { return "{0:N2} TB" -f ($Bytes / 1TB) }
    if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}

function Format-TimeSpan {
    param([TimeSpan]$TimeSpan)

    if ($null -eq $TimeSpan) { return "00:00:00" }
    return "{0:D2}:{1:D2}:{2:D2}" -f [int]$TimeSpan.TotalHours, $TimeSpan.Minutes, $TimeSpan.Seconds
}

function Get-SafeSum {
    <#
    .SYNOPSIS
        Safely calculates sum of a property, returning 0 instead of $null for empty collections.
    .DESCRIPTION
        Measure-Object -Sum returns $null when operating on empty collections or when all
        values are $null. This helper ensures a numeric 0 is returned instead.
    #>
    param(
        [array]$Items,
        [string]$Property
    )
    if ($null -eq $Items -or $Items.Count -eq 0) { return 0 }
    $result = ($Items | Measure-Object -Property $Property -Sum -ErrorAction SilentlyContinue).Sum
    if ($null -eq $result) { return 0 }
    return $result
}

function Get-PathStats {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return @{ FileCount = 0; FolderCount = 0; SizeBytes = 0 }
    }

    try {
        $files = @(Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue)
        $folders = @(Get-ChildItem -Path $Path -Recurse -Directory -ErrorAction SilentlyContinue)

        return @{
            FileCount = $files.Count
            FolderCount = $folders.Count
            SizeBytes = (Get-SafeSum -Items $files -Property Length)
        }
    } catch {
        return @{ FileCount = 0; FolderCount = 0; SizeBytes = 0 }
    }
}

function Test-NetworkAccess {
    param(
        [string]$Path,
        [int]$MaxRetries = 3,
        [int]$RetryDelay = 5
    )

    Write-LogSection "Network Access Test"
    Write-Log "Target: $Path"

    for ($i = 1; $i -le $MaxRetries; $i++) {
        Write-Log "Attempt $i of $MaxRetries..."

        $testStart = Get-Date
        $accessible = Test-Path $Path -ErrorAction SilentlyContinue
        $testDuration = (Get-Date) - $testStart

        if ($accessible) {
            Write-Log "Network share is ACCESSIBLE" -Level Success
            return $true
        }

        Write-Log "  FAILED - share not accessible" -Level Warning

        if ($i -lt $MaxRetries) {
            Start-Sleep -Seconds $RetryDelay
        }
    }

    Write-Log "FAILED to access network share after $MaxRetries attempts" -Level Error
    return $false
}

function Get-RobocopyStatus {
    param([int]$ExitCode)

    $success = $ExitCode -lt 8

    $message = switch ($ExitCode) {
        0  { "No changes needed" }
        1  { "Files copied successfully" }
        2  { "Extra files detected" }
        3  { "Files copied, extra files detected" }
        4  { "Mismatched files detected" }
        5  { "Files copied, mismatched detected" }
        6  { "Extra and mismatched detected" }
        7  { "Files copied, extra and mismatched" }
        8  { "Some files could not be copied" }
        16 { "Fatal error occurred" }
        default { "Unknown exit code: $ExitCode" }
    }

    return @{
        Success = $success
        Message = $message
        ExitCode = $ExitCode
    }
}

function Stop-TranscriptSafe {
    try {
        Stop-Transcript -ErrorAction SilentlyContinue | Out-Null
    } catch { }
}

function Ensure-Folder {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
    return $Path
}

function Play-CompletionSound {
    try {
        [System.Media.SystemSounds]::Exclamation.Play()
    } catch { }
}

function Show-FolderBrowser {
    param([string]$StartPath)

    $folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
    $folderBrowser.Description = "Select the backup folder to restore from"
    $folderBrowser.RootFolder = [System.Environment+SpecialFolder]::MyComputer
    $folderBrowser.SelectedPath = $StartPath
    $folderBrowser.ShowNewFolderButton = $false

    $result = $folderBrowser.ShowDialog()

    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        return $folderBrowser.SelectedPath
    }

    return $null
}

function Get-BackupMetadata {
    param([string]$BackupPath)

    $metadataPath = Join-Path $BackupPath "BackupMetadata.json"

    if (-not (Test-Path $metadataPath)) {
        return $null
    }

    try {
        $content = Get-Content -Path $metadataPath -Raw -Encoding UTF8
        return $content | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Get-RestoreItems {
    param([object]$Metadata, [string]$BackupPath)

    $userProfile = $env:USERPROFILE
    $appData = $env:APPDATA
    $localAppData = $env:LOCALAPPDATA

    $restoreMapping = @{
        "Documents" = @{ TargetPath = Join-Path $userProfile "Documents"; Type = "Directory" }
        "Desktop" = @{ TargetPath = Join-Path $userProfile "Desktop"; Type = "Directory" }
        "Pictures" = @{ TargetPath = Join-Path $userProfile "Pictures"; Type = "Directory" }
        "Avaya" = @{ TargetPath = Join-Path $appData "Avaya"; Type = "Directory" }
        "Signatures" = @{ TargetPath = Join-Path $appData "Microsoft\Signatures"; Type = "Directory" }
        "SAS" = @{ TargetPath = Join-Path $appData "SAS"; Type = "Directory" }
        "RecentItems" = @{ TargetPath = Join-Path $appData "Microsoft\Windows\Recent\AutomaticDestinations"; Type = "File" }
        "ChromeBookmarks" = @{ TargetPath = Join-Path $localAppData "Google\Chrome\User Data\Default"; Type = "File" }
        "EdgeBookmarks" = @{ TargetPath = Join-Path $localAppData "Microsoft\Edge\User Data\Default"; Type = "File" }
        "LotusNotesData" = @{ TargetPath = Join-Path $localAppData "Lotus\Notes\Data"; Type = "Directory" }
        "OfficeDictionaries" = @{ TargetPath = Join-Path $appData "Microsoft\UProof"; Type = "Directory" }
    }

    $items = @()

    foreach ($backupItem in $Metadata.Items) {
        $name = $backupItem.Name
        $sourcePath = Join-Path $BackupPath $name

        if ($restoreMapping.ContainsKey($name)) {
            $mapping = $restoreMapping[$name]
            $exists = Test-Path $sourcePath

            $items += @{
                Name = $name
                SourcePath = $sourcePath
                TargetPath = $mapping.TargetPath
                Type = $mapping.Type
                BackupSizeBytes = $backupItem.SizeBytes
                BackupFileCount = $backupItem.FileCount
                BackupSuccess = $backupItem.Success
                ExistsInBackup = $exists
            }
        }
    }

    return $items
}

function Send-RestoreNotificationEmail {
    param(
        [string]$BackupPath,
        [array]$Results,
        [datetime]$StartTime,
        [datetime]$EndTime,
        [string]$OriginalMachine,
        [string]$RestoreMachine,
        [string]$UserName
    )

    Write-LogSection "Sending Email Notification"

    try {
        $outlook = New-Object -ComObject Outlook.Application
        $mail = $outlook.CreateItem(0)

        $session = $outlook.Session
        $currentUser = $session.CurrentUser
        $userEmail = $currentUser.Address

        if (-not $userEmail -or $userEmail -notmatch '@') {
            $accounts = $session.Accounts
            if ($accounts.Count -gt 0) {
                $userEmail = $accounts.Item(1).SmtpAddress
            }
        }

        if (-not $userEmail) {
            Write-Log "Could not determine user email address" -Level Error
            return $false
        }

        Write-Log "Sending to: $userEmail"

        $duration = $EndTime - $StartTime
        $successResults = @($Results | Where-Object { $_.Success -eq $true })
        $successCount = $successResults.Count
        $failedCount = @($Results | Where-Object { $_.Success -eq $false -and $_.Skipped -eq $false }).Count
        $skippedCount = @($Results | Where-Object { $_.Skipped -eq $true }).Count
        $totalSize = Get-SafeSum -Items $successResults -Property SizeBytes
        $totalFiles = Get-SafeSum -Items $successResults -Property FileCount

        $statusColor = if ($failedCount -eq 0) { "#28a745" } else { "#dc3545" }
        $statusText = if ($failedCount -eq 0) { "SUCCESS" } else { "COMPLETED WITH ERRORS" }

        $itemsHtml = ""
        foreach ($item in $Results) {
            $icon = if ($item.Success) { "&#10004;" } elseif ($item.Skipped) { "&#9675;" } else { "&#10008;" }
            $color = if ($item.Success) { "#28a745" } elseif ($item.Skipped) { "#6c757d" } else { "#dc3545" }
            $size = if ($item.Success) { Format-Bytes $item.SizeBytes } else { "-" }
            $status = if ($item.Success) { "OK" } elseif ($item.Skipped) { "Skipped" } else { "Failed" }

            $itemsHtml += @"
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #dee2e6;"><span style="color: $color;">$icon</span> $($item.Name)</td>
                <td style="padding: 8px; border-bottom: 1px solid #dee2e6; text-align: right;">$size</td>
                <td style="padding: 8px; border-bottom: 1px solid #dee2e6; text-align: center; color: $color;">$status</td>
            </tr>
"@
        }

        $machineWarning = ""
        if ($OriginalMachine -ne $RestoreMachine) {
            $machineWarning = @"
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 10px; margin: 10px 0;">
                <strong>Note:</strong> This backup was restored from a different machine ($OriginalMachine).
            </div>
"@
        }

        # Collect all failed files across all results (Issue 4)
        $allFailedFiles = @()
        foreach ($item in $Results) {
            if ($item.FailedFiles -and $item.FailedFiles.Count -gt 0) {
                foreach ($ff in $item.FailedFiles) {
                    $allFailedFiles += @{ ItemName = $item.Name; FilePath = $ff }
                }
            }
        }

        $failedFilesHtml = ""
        if ($allFailedFiles.Count -gt 0) {
            $failedFilesHtml = @"
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin-top: 15px;">
                <p style="margin: 0 0 10px 0; color: #721c24; font-weight: bold;">&#9888; Failed Files ($($allFailedFiles.Count) file(s) could not be restored):</p>
                <ul style="margin: 0; padding-left: 20px; color: #721c24; font-size: 12px;">
"@
            # Limit to first 20 files to avoid massive emails
            $displayFiles = $allFailedFiles | Select-Object -First 20
            foreach ($ff in $displayFiles) {
                $failedFilesHtml += "                    <li><strong>[$($ff.ItemName)]</strong> $($ff.FilePath)</li>`n"
            }
            if ($allFailedFiles.Count -gt 20) {
                $failedFilesHtml += "                    <li><em>... and $($allFailedFiles.Count - 20) more files</em></li>`n"
            }
            $failedFilesHtml += @"
                </ul>
            </div>
"@
        }

        $htmlBody = @"
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
        .footer { background-color: #e9ecef; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
        .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; color: white; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0; }
        .stat-box { background: white; padding: 10px; border-radius: 5px; border: 1px solid #dee2e6; }
        .stat-label { font-size: 12px; color: #6c757d; }
        .stat-value { font-size: 18px; font-weight: bold; color: #28a745; }
        table { width: 100%; border-collapse: collapse; background: white; margin-top: 15px; }
        th { background-color: #28a745; color: white; padding: 10px; text-align: left; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0;">FAK Restore Complete</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">$($StartTime.ToString("dddd, MMMM d, yyyy 'at' h:mm tt"))</p>
        </div>

        <div class="content">
            <p><span class="status-badge" style="background-color: $statusColor;">$statusText</span></p>

            $machineWarning

            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-label">Duration</div>
                    <div class="stat-value">$(Format-TimeSpan $duration)</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Total Size</div>
                    <div class="stat-value">$(Format-Bytes $totalSize)</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Files Restored</div>
                    <div class="stat-value">$($totalFiles.ToString("N0"))</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Items</div>
                    <div class="stat-value">$successCount OK / $failedCount Failed</div>
                </div>
            </div>

            <h3 style="margin-top: 20px;">Restore Details</h3>
            <table>
                <tr><td style="padding: 5px; width: 140px;"><strong>Original Machine:</strong></td><td>$OriginalMachine</td></tr>
                <tr><td style="padding: 5px;"><strong>Restored To:</strong></td><td>$RestoreMachine</td></tr>
                <tr><td style="padding: 5px;"><strong>User:</strong></td><td>$UserName</td></tr>
                <tr><td style="padding: 5px;"><strong>Backup Location:</strong></td><td style="word-break: break-all;">$BackupPath</td></tr>
                <tr><td style="padding: 5px;"><strong>Started:</strong></td><td>$($StartTime.ToString("yyyy-MM-dd hh:mm:ss tt"))</td></tr>
                <tr><td style="padding: 5px;"><strong>Completed:</strong></td><td>$($EndTime.ToString("yyyy-MM-dd hh:mm:ss tt"))</td></tr>
            </table>

            <h3 style="margin-top: 20px;">Item Results</h3>
            <table>
                <tr>
                    <th>Item</th>
                    <th style="text-align: right;">Size</th>
                    <th style="text-align: center;">Status</th>
                </tr>
                $itemsHtml
            </table>

            $failedFilesHtml

            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin-top: 20px;">
                <p style="margin: 0;"><strong>Your files have been restored successfully!</strong></p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #155724;">Please verify your restored files are accessible.</p>
            </div>
        </div>

        <div class="footer">
            <p style="margin: 0;">FAK (First Aid Kit) Restore Script V$($script:RestoreVersion)</p>
            <p style="margin: 5px 0 0 0;">This is an automated notification.</p>
        </div>
    </div>
</body>
</html>
"@

        $mail.To = $userEmail
        $mail.Subject = "FAK Restore Complete - $RestoreMachine - $($StartTime.ToString('yyyy-MM-dd'))"
        $mail.HTMLBody = $htmlBody

        # Add CC if configured
        if ($script:EmailCC) {
            $mail.CC = $script:EmailCC
            Write-Log "CC: $($script:EmailCC)" -Level Debug
        }

        # Add BCC if configured
        if ($script:EmailBCC) {
            $mail.BCC = $script:EmailBCC
        }

        $mail.Send()
        Write-Log "Email notification sent successfully" -Level Success

        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($mail) | Out-Null
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($outlook) | Out-Null

        return $true

    } catch {
        Write-Log "Failed to send email notification: $_" -Level Error

        [System.Windows.MessageBox]::Show(
            "The restore completed successfully, but the email notification could not be sent.`n`nError: $_",
            "Email Notification Failed",
            [System.Windows.MessageBoxButton]::OK,
            [System.Windows.MessageBoxImage]::Warning
        ) | Out-Null

        return $false
    }
}

#endregion

#region Non-Blocking Robocopy Functions (V3.09 Fix)
# =============================================================================
# NON-BLOCKING ROBOCOPY FUNCTIONS (V3.09 FIX)
# =============================================================================
# This section implements the timer-driven state machine that replaced the
# blocking robocopy loop from earlier versions. The key insight is that
# robocopy runs as an external process, and we can monitor it without blocking.
#
# Key Functions:
# - Start-RobocopyProcess: Launches robocopy asynchronously, returns process
#   object and temp file for output monitoring
# - Get-CurrentRobocopyFile: Parses robocopy output to find current file
# - Complete-RobocopyProcess: Handles process completion, parses results
#
# How It Works:
# 1. Start-RobocopyProcess launches robocopy.exe redirecting output to temp file
# 2. Timer tick handler checks if process has exited (HasExited property)
# 3. While running, Get-CurrentRobocopyFile reads temp file for progress
# 4. When process exits, Complete-RobocopyProcess parses final results
#
# Benefits over blocking approach:
# - UI remains responsive (elapsed timer updates, cancel button works)
# - User can see current file being restored
# - No UI freezing during long file operations
# =============================================================================

function Start-RobocopyProcess {
    <#
    .SYNOPSIS
        Starts robocopy process and returns immediately (non-blocking).
        Returns process object and temp file path for monitoring.
    #>
    param(
        [string]$Source,
        [string]$Destination,
        [switch]$IsFile
    )

    Write-Log "Start-RobocopyProcess: Launching robocopy (non-blocking)" -Level Debug
    Write-Log "  Source: $Source" -Level Debug
    Write-Log "  Destination: $Destination" -Level Debug

    $destDir = if ($IsFile) { Split-Path $Destination -Parent } else { $Destination }
    if (-not (Test-Path $destDir)) {
        Ensure-Folder -Path $destDir | Out-Null
    }

    $robocopyParams = @(
        '/COPY:DAT',
        '/DCOPY:DAT',
        '/R:5',
        '/W:3',
        "/MT:$script:RobocopyThreads",
        '/NP',
        '/XJ',
        '/XJD',
        '/XJF',
        '/SL',
        '/V',
        '/BYTES',
        '/TEE'
    )

    if ($IsFile) {
        $sourceDir = Split-Path $Source -Parent
        $fileName = Split-Path $Source -Leaf
        $robocopyArgs = "`"$sourceDir`" `"$Destination`" `"$fileName`" $($robocopyParams -join ' ')"
    } else {
        $robocopyParams += '/E'
        $robocopyParams += '/IS'
        $robocopyParams += '/IT'
        $robocopyArgs = "`"$Source`" `"$Destination`" $($robocopyParams -join ' ')"
    }

    if ($WhatIf) {
        $robocopyArgs += " /L"
    }

    $tempOut = [System.IO.Path]::GetTempFileName()
    $tempErr = [System.IO.Path]::GetTempFileName()

    $process = Start-Process -FilePath "robocopy.exe" -ArgumentList $robocopyArgs -NoNewWindow -PassThru -RedirectStandardOutput $tempOut -RedirectStandardError $tempErr

    return @{
        Process = $process
        OutputFile = $tempOut
        ErrorFile = $tempErr
        StartTime = Get-Date
    }
}

function Get-CurrentRobocopyFile {
    <#
    .SYNOPSIS
        Reads the robocopy output file and extracts the current file being processed.
    #>
    param([string]$OutputFile)

    if (-not (Test-Path $OutputFile)) { return "" }

    try {
        # Read last 30 lines to find most recent file activity
        $content = Get-Content $OutputFile -Tail 30 -ErrorAction SilentlyContinue
        if (-not $content) { return "" }

        # Look for lines indicating file copy activity
        for ($i = $content.Count - 1; $i -ge 0; $i--) {
            $line = $content[$i]
            # Match lines like "  New File  1234567  filename.ext"
            if ($line -match '^\s*(New File|Newer|Older|Changed|Same)\s+\d+\s+(.+)$') {
                return $Matches[2].Trim()
            }
            # Match percentage progress lines
            if ($line -match '^\s*(\d+(\.\d+)?%)\s+(.+)$') {
                return $Matches[3].Trim()
            }
            # Match simple file copy lines
            if ($line -match '^\s+(.+\.\w+)\s*$' -and $line -notmatch '(ERROR|Directory|Bytes)') {
                return $Matches[1].Trim()
            }
        }
    } catch { }

    return ""
}

function Complete-RobocopyProcess {
    <#
    .SYNOPSIS
        Called when robocopy process has exited. Parses output and returns result.
    #>
    param(
        [System.Diagnostics.Process]$Process,
        [string]$OutputFile,
        [string]$ErrorFile,
        [datetime]$StartTime,
        [switch]$TimedOut
    )

    $processDuration = (Get-Date) - $StartTime

    # Parse errors
    $failedFiles = @()
    if (Test-Path $OutputFile) {
        try {
            $robocopyOutput = Get-Content $OutputFile -ErrorAction SilentlyContinue
            $errorLines = $robocopyOutput | Where-Object { $_ -match '^\s*ERROR\s+' -or $_ -match 'Access is denied' }
            if ($errorLines) {
                foreach ($errorLine in $errorLines) {
                    $failedFiles += $errorLine.Trim()
                }
            }
        } catch { }
    }

    # Cleanup temp files
    Remove-Item $OutputFile -Force -ErrorAction SilentlyContinue
    Remove-Item $ErrorFile -Force -ErrorAction SilentlyContinue

    if ($TimedOut) {
        return @{
            Success = $false
            Message = "Timeout after $script:RobocopyTimeoutMinutes minutes"
            ExitCode = -1
            FailedFiles = $failedFiles
            Duration = $processDuration
        }
    }

    $result = Get-RobocopyStatus -ExitCode $Process.ExitCode
    $result.FailedFiles = $failedFiles
    $result.Duration = $processDuration
    return $result
}

#endregion

#region WPF UI
# =============================================================================
# WPF USER INTERFACE
# =============================================================================
# This section defines the WPF-based user interface for the restore process.
# The UI is defined in XAML and managed through PowerShell event handlers.
#
# UI Panels (managed via Visibility):
# - SelectionPanel: Item selection with checkboxes (initially visible)
# - ProgressPanel: Progress bar and status during restore (hidden initially)
# - CompletionPanel: Results summary after restore completes (hidden initially)
#
# State Machine States:
# - Idle: Initial state, waiting for user to start restore
# - Starting: Preparing to restore next item, launching robocopy
# - Running: Robocopy process active, monitoring progress
# - ProcessComplete: Item finished, recording results, moving to next
# - AllComplete: All items processed, saving metadata, sending email
# - Done: Restore complete, showing results panel
# - Cancelled: User cancelled operation
#
# Timer-Driven Architecture:
# The DispatcherTimer fires every 100ms. Each tick:
# 1. Always updates elapsed time label (never blocked)
# 2. Executes current state logic
# 3. Transitions to next state as needed
#
# This ensures the UI remains responsive even during long file operations.
# =============================================================================

function Show-WpfRestoreDialog {
    param(
        [object]$Metadata,
        [array]$Items,
        [string]$BackupPath,
        [switch]$WhatIf
    )

    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="FAK Restore V3.09$(if ($WhatIf) { ' - DRY RUN' } else { '' })"
        Height="680" Width="620"
        WindowStartupLocation="CenterScreen"
        ResizeMode="NoResize"
        Background="#FFFFFF">
    <Window.Resources>
        <Style x:Key="ModernButton" TargetType="Button">
            <Setter Property="Background" Value="#28A745"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="Padding" Value="20,10"/>
            <Setter Property="BorderThickness" Value="0"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Border Background="{TemplateBinding Background}"
                                CornerRadius="4"
                                Padding="{TemplateBinding Padding}">
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsMouseOver" Value="True">
                                <Setter Property="Background" Value="#218838"/>
                            </Trigger>
                            <Trigger Property="IsPressed" Value="True">
                                <Setter Property="Background" Value="#1e7e34"/>
                            </Trigger>
                            <Trigger Property="IsEnabled" Value="False">
                                <Setter Property="Background" Value="#CCCCCC"/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
        <Style x:Key="CancelButton" TargetType="Button" BasedOn="{StaticResource ModernButton}">
            <Setter Property="Background" Value="#E0E0E0"/>
            <Setter Property="Foreground" Value="#333333"/>
            <Style.Triggers>
                <Trigger Property="IsMouseOver" Value="True">
                    <Setter Property="Background" Value="#D0D0D0"/>
                </Trigger>
            </Style.Triggers>
        </Style>
        <Style x:Key="ModernProgressBar" TargetType="ProgressBar">
            <Setter Property="Height" Value="24"/>
            <Setter Property="Background" Value="#E0E0E0"/>
            <Setter Property="Foreground" Value="#28A745"/>
            <Setter Property="BorderThickness" Value="0"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="ProgressBar">
                        <Grid>
                            <Border Background="{TemplateBinding Background}" CornerRadius="4"/>
                            <Border x:Name="PART_Track" CornerRadius="4"/>
                            <Border x:Name="PART_Indicator" CornerRadius="4"
                                    Background="{TemplateBinding Foreground}"
                                    HorizontalAlignment="Left"/>
                        </Grid>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </Window.Resources>

    <Grid>
        <!-- Selection Panel -->
        <Grid x:Name="SelectionPanel">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <StackPanel Grid.Row="0" Margin="20,20,20,10">
                <TextBlock Text="Select Items to Restore" FontSize="20" FontWeight="SemiBold" Foreground="#333"/>
                <TextBlock x:Name="BackupNameLabel" FontSize="12" Foreground="#666" Margin="0,5,0,0"/>
                <TextBlock x:Name="BackupDateLabel" FontSize="12" Foreground="#888" Margin="0,3,0,0"/>
                <TextBlock x:Name="MachineWarningLabel" FontSize="12" Foreground="#FF8C00" FontWeight="SemiBold" Margin="0,5,0,0" Visibility="Collapsed"/>
                <TextBlock x:Name="DestinationLabel" FontSize="12" Foreground="#888" Margin="0,3,0,0"/>
            </StackPanel>

            <Border Grid.Row="1" Margin="20,10" BorderBrush="#E0E0E0" BorderThickness="1" CornerRadius="4">
                <ScrollViewer VerticalScrollBarVisibility="Auto">
                    <StackPanel x:Name="ItemsPanel" Margin="10"/>
                </ScrollViewer>
            </Border>

            <Grid Grid.Row="2" Margin="20,10,20,20">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                    <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>

                <TextBlock x:Name="SummaryLabel" Grid.Column="0" VerticalAlignment="Center" FontWeight="SemiBold"/>
                <Button x:Name="CancelButton" Grid.Column="1" Content="Cancel" Style="{StaticResource CancelButton}" Margin="0,0,10,0"/>
                <Button x:Name="StartButton" Grid.Column="2" Content="Start Restore" Style="{StaticResource ModernButton}"/>
            </Grid>
        </Grid>

        <!-- Progress Panel -->
        <Grid x:Name="ProgressPanel" Visibility="Collapsed">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <StackPanel Grid.Row="0" Margin="20,20,20,10">
                <TextBlock x:Name="ProgressTitle" Text="Restoring Files..." FontSize="20" FontWeight="SemiBold" Foreground="#333"/>
                <TextBlock x:Name="ElapsedLabel" Text="Elapsed: 00:00:00" FontSize="14" Foreground="#666" Margin="0,5,0,0"/>
            </StackPanel>

            <StackPanel Grid.Row="1" Margin="20,10">
                <TextBlock Text="Overall Progress:" FontSize="12" Foreground="#666" Margin="0,0,0,5"/>
                <ProgressBar x:Name="OverallProgress" Style="{StaticResource ModernProgressBar}" Height="28"/>
                <TextBlock x:Name="OverallProgressText" Text="0%" HorizontalAlignment="Center" Margin="0,5,0,15" FontWeight="SemiBold"/>

                <TextBlock x:Name="CurrentItemLabel" Text="Current Item:" FontSize="12" Foreground="#666" Margin="0,0,0,5"/>
                <ProgressBar x:Name="ItemProgress" Style="{StaticResource ModernProgressBar}" Height="20" Foreground="#0078D4"/>
                <TextBlock x:Name="CurrentFileLabel" Text="" FontSize="11" Foreground="#888" Margin="0,5,0,0" TextTrimming="CharacterEllipsis"/>
            </StackPanel>

            <Border Grid.Row="2" Margin="20,10" BorderBrush="#E0E0E0" BorderThickness="1" CornerRadius="4">
                <ScrollViewer VerticalScrollBarVisibility="Auto">
                    <StackPanel x:Name="StatusPanel" Margin="10"/>
                </ScrollViewer>
            </Border>

            <Button x:Name="ProgressCancelButton" Grid.Row="3" Content="Cancel"
                    Style="{StaticResource CancelButton}"
                    HorizontalAlignment="Right" Margin="20,10,20,20"/>
        </Grid>

        <!-- Complete Panel -->
        <Grid x:Name="CompletePanel" Visibility="Collapsed">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <StackPanel Grid.Row="0" Margin="20,20,20,10">
                <TextBlock x:Name="CompleteTitle" Text="Restore Complete" FontSize="20" FontWeight="SemiBold" Foreground="#28A745"/>
                <TextBlock x:Name="CompleteStatus" FontSize="14" Foreground="#666" Margin="0,5,0,0" TextWrapping="Wrap"/>
                <TextBlock x:Name="CompleteDuration" FontSize="12" Foreground="#888" Margin="0,5,0,0"/>
            </StackPanel>

            <Border Grid.Row="1" Margin="20,10" BorderBrush="#E0E0E0" BorderThickness="1" CornerRadius="4">
                <ScrollViewer VerticalScrollBarVisibility="Auto">
                    <StackPanel x:Name="ResultsPanel" Margin="10"/>
                </ScrollViewer>
            </Border>

            <Button x:Name="CloseButton" Grid.Row="2" Content="Close"
                    Style="{StaticResource ModernButton}"
                    HorizontalAlignment="Right" Margin="20,10,20,20"/>
        </Grid>
    </Grid>
</Window>
"@

    $reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml))
    $window = [System.Windows.Markup.XamlReader]::Load($reader)

    # Get controls
    $selectionPanel = $window.FindName("SelectionPanel")
    $progressPanel = $window.FindName("ProgressPanel")
    $completePanel = $window.FindName("CompletePanel")

    $backupNameLabel = $window.FindName("BackupNameLabel")
    $backupDateLabel = $window.FindName("BackupDateLabel")
    $machineWarningLabel = $window.FindName("MachineWarningLabel")
    $destinationLabel = $window.FindName("DestinationLabel")
    $itemsPanel = $window.FindName("ItemsPanel")
    $summaryLabel = $window.FindName("SummaryLabel")
    $cancelButton = $window.FindName("CancelButton")
    $startButton = $window.FindName("StartButton")

    $progressTitle = $window.FindName("ProgressTitle")
    $elapsedLabel = $window.FindName("ElapsedLabel")
    $overallProgress = $window.FindName("OverallProgress")
    $overallProgressText = $window.FindName("OverallProgressText")
    $currentItemLabel = $window.FindName("CurrentItemLabel")
    $itemProgress = $window.FindName("ItemProgress")
    $currentFileLabel = $window.FindName("CurrentFileLabel")
    $statusPanel = $window.FindName("StatusPanel")
    $progressCancelButton = $window.FindName("ProgressCancelButton")

    $completeTitle = $window.FindName("CompleteTitle")
    $completeStatus = $window.FindName("CompleteStatus")
    $completeDuration = $window.FindName("CompleteDuration")
    $resultsPanel = $window.FindName("ResultsPanel")
    $closeButton = $window.FindName("CloseButton")

    # State - V3.09: Added state machine fields
    $script:DialogState = @{
        SelectedItems = @()
        Checkboxes = @{}
        IsRunning = $false
        IsCancelled = $false
        Results = @()
        Stopwatch = $null
        Timer = $null
        BackupPath = $BackupPath

        # V3.09 State Machine Fields
        CurrentItemIndex = 0
        CopyState = "Idle"           # Idle, Starting, Running, ProcessComplete, AllComplete, Cancelled
        CurrentProcess = $null
        OutputTempFile = $null
        ErrorTempFile = $null
        ProcessStartTime = $null
        TotalItems = 0

        UI = @{
            Window = $window
            SelectionPanel = $selectionPanel
            ProgressPanel = $progressPanel
            CompletePanel = $completePanel
            OverallProgress = $overallProgress
            OverallProgressText = $overallProgressText
            CurrentItemLabel = $currentItemLabel
            ItemProgress = $itemProgress
            CurrentFileLabel = $currentFileLabel
            StatusPanel = $statusPanel
            CompleteTitle = $completeTitle
            CompleteStatus = $completeStatus
            CompleteDuration = $completeDuration
            ResultsPanel = $resultsPanel
            ElapsedLabel = $elapsedLabel
        }
    }

    # Initialize UI
    $backupNameLabel.Text = "Backup: $($Metadata.BackupName)"
    $backupDateStr = if ($Metadata.BackupDate -is [datetime]) { $Metadata.BackupDate.ToString("yyyy-MM-dd hh:mm tt") } else { $Metadata.BackupDate }
    $backupDateLabel.Text = "Created: $backupDateStr | Machine: $($Metadata.MachineName)"
    $destinationLabel.Text = "Restoring to: $env:USERNAME on $env:COMPUTERNAME"

    if ($Metadata.MachineName -ne $env:COMPUTERNAME) {
        $machineWarningLabel.Text = "Warning: This backup is from a different machine ($($Metadata.MachineName))"
        $machineWarningLabel.Visibility = [System.Windows.Visibility]::Visible
    }

    # Create checkboxes
    foreach ($item in $Items) {
        $grid = New-Object System.Windows.Controls.Grid
        $grid.Margin = [System.Windows.Thickness]::new(0, 5, 0, 5)

        $col1 = New-Object System.Windows.Controls.ColumnDefinition
        $col1.Width = [System.Windows.GridLength]::new(1, [System.Windows.GridUnitType]::Star)
        $col2 = New-Object System.Windows.Controls.ColumnDefinition
        $col2.Width = [System.Windows.GridLength]::new(100)

        $grid.ColumnDefinitions.Add($col1)
        $grid.ColumnDefinitions.Add($col2)

        $checkbox = New-Object System.Windows.Controls.CheckBox
        $checkbox.Content = $item.Name
        $checkbox.IsChecked = $item.ExistsInBackup -and $item.BackupSuccess
        $checkbox.IsEnabled = $item.ExistsInBackup -and $item.BackupSuccess
        $checkbox.Tag = @{ Item = $item; Size = $item.BackupSizeBytes; Exists = $item.ExistsInBackup }
        $checkbox.FontSize = 13

        if (-not $item.ExistsInBackup -or -not $item.BackupSuccess) {
            $checkbox.Foreground = [System.Windows.Media.Brushes]::Gray
            $checkbox.Content = "$($item.Name) (Not in backup)"
        }

        [System.Windows.Controls.Grid]::SetColumn($checkbox, 0)

        $sizeLabel = New-Object System.Windows.Controls.TextBlock
        $sizeLabel.Text = if ($item.ExistsInBackup) { Format-Bytes $item.BackupSizeBytes } else { "-" }
        $sizeLabel.Foreground = if ($item.ExistsInBackup) { [System.Windows.Media.Brushes]::Gray } else { [System.Windows.Media.Brushes]::LightGray }
        $sizeLabel.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Right
        $sizeLabel.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
        $sizeLabel.FontFamily = New-Object System.Windows.Media.FontFamily("Consolas")

        [System.Windows.Controls.Grid]::SetColumn($sizeLabel, 1)

        $grid.Children.Add($checkbox)
        $grid.Children.Add($sizeLabel)
        $itemsPanel.Children.Add($grid)

        $script:DialogState.Checkboxes[$item.Name] = $checkbox
    }

    # Update summary
    $updateSummary = {
        $selectedCount = 0
        $totalSize = [long]0

        foreach ($cb in $script:DialogState.Checkboxes.Values) {
            if ($cb.IsChecked -and $cb.Tag.Exists) {
                $selectedCount++
                $totalSize += $cb.Tag.Size
            }
        }

        $summaryLabel.Text = "Selected: $selectedCount items | Size: $(Format-Bytes $totalSize)"
        $startButton.IsEnabled = ($selectedCount -gt 0)
    }

    foreach ($cb in $script:DialogState.Checkboxes.Values) {
        $cb.Add_Checked($updateSummary)
        $cb.Add_Unchecked($updateSummary)
    }

    & $updateSummary

    $cancelButton.Add_Click({
        $window.DialogResult = $false
        $window.Close()
    })

    $closeButton.Add_Click({
        $window.DialogResult = $true
        $window.Close()
    })

    $progressCancelButton.Add_Click({
        $script:DialogState.IsCancelled = $true
        $script:DialogState.CopyState = "Cancelled"
        if ($null -ne $script:DialogState.CurrentProcess -and -not $script:DialogState.CurrentProcess.HasExited) {
            try { $script:DialogState.CurrentProcess.Kill() } catch { }
        }
    })

    # Start button - V3.09: Simplified - just initializes state, timer handles the rest
    $startButton.Add_Click({
        $script:DialogState.SelectedItems = @()
        foreach ($item in $Items) {
            $cb = $script:DialogState.Checkboxes[$item.Name]
            if ($cb.IsChecked -and $cb.Tag.Exists) {
                $script:DialogState.SelectedItems += @{
                    Item = $item
                    Size = $cb.Tag.Size
                }
            }
        }

        if ($script:DialogState.SelectedItems.Count -eq 0) { return }

        $selectionPanel.Visibility = [System.Windows.Visibility]::Collapsed
        $progressPanel.Visibility = [System.Windows.Visibility]::Visible

        $statusPanel.Children.Clear()
        foreach ($selected in $script:DialogState.SelectedItems) {
            $statusText = New-Object System.Windows.Controls.TextBlock
            $statusText.Text = [char]0x25CB + " " + $selected.Item.Name + " (" + (Format-Bytes $selected.Size) + ")"
            $statusText.Foreground = [System.Windows.Media.Brushes]::LightGray
            $statusText.Margin = [System.Windows.Thickness]::new(0, 3, 0, 3)
            $statusText.Tag = $selected.Item.Name
            $statusPanel.Children.Add($statusText)
        }

        # V3.09: Initialize state machine
        $script:DialogState.IsRunning = $true
        $script:DialogState.Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $script:DialogState.Results = @()
        $script:DialogState.CurrentItemIndex = 0
        $script:DialogState.CopyState = "Starting"
        $script:DialogState.TotalItems = $script:DialogState.SelectedItems.Count
        $script:DialogState.CurrentProcess = $null
        $script:DialogState.OutputTempFile = $null
        $script:DialogState.ErrorTempFile = $null

        $script:DialogState.Timer = New-Object System.Windows.Threading.DispatcherTimer
        $script:DialogState.Timer.Interval = [TimeSpan]::FromMilliseconds(100)

        # V3.09: State machine tick handler
        $script:DialogState.Timer.Add_Tick({
            # Always update elapsed time first (never blocked!)
            $elapsed = $script:DialogState.Stopwatch.Elapsed
            $script:DialogState.UI.ElapsedLabel.Text = "Elapsed: " + ("{0:D2}:{1:D2}:{2:D2}" -f [int]$elapsed.TotalHours, $elapsed.Minutes, $elapsed.Seconds)

            # State machine
            switch ($script:DialogState.CopyState) {
                "Cancelled" {
                    $script:DialogState.Timer.Stop()
                    $script:DialogState.Stopwatch.Stop()
                    $script:DialogState.IsRunning = $false

                    # Cleanup any temp files
                    if ($script:DialogState.OutputTempFile -and (Test-Path $script:DialogState.OutputTempFile)) {
                        Remove-Item $script:DialogState.OutputTempFile -Force -ErrorAction SilentlyContinue
                    }
                    if ($script:DialogState.ErrorTempFile -and (Test-Path $script:DialogState.ErrorTempFile)) {
                        Remove-Item $script:DialogState.ErrorTempFile -Force -ErrorAction SilentlyContinue
                    }

                    $script:DialogState.UI.ProgressPanel.Visibility = [System.Windows.Visibility]::Collapsed
                    $script:DialogState.UI.CompletePanel.Visibility = [System.Windows.Visibility]::Visible
                    $script:DialogState.UI.CompleteTitle.Text = "Restore Cancelled"
                    $script:DialogState.UI.CompleteTitle.Foreground = [System.Windows.Media.Brushes]::Orange
                    $script:DialogState.CopyState = "Done"
                }

                "Starting" {
                    # Check if we've processed all items
                    if ($script:DialogState.CurrentItemIndex -ge $script:DialogState.TotalItems) {
                        $script:DialogState.CopyState = "AllComplete"
                        return
                    }

                    $idx = $script:DialogState.CurrentItemIndex
                    $selected = $script:DialogState.SelectedItems[$idx]
                    $item = $selected.Item

                    # Update UI for starting this item
                    $script:DialogState.UI.OverallProgress.Value = [Math]::Round(($idx / [Math]::Max(1, $script:DialogState.TotalItems)) * 100)
                    $script:DialogState.UI.OverallProgressText.Text = "$([Math]::Round(($idx / [Math]::Max(1, $script:DialogState.TotalItems)) * 100))%"
                    $script:DialogState.UI.CurrentItemLabel.Text = "[$($idx + 1)/$($script:DialogState.TotalItems)] $($item.Name)"
                    $script:DialogState.UI.ItemProgress.Value = 0
                    $script:DialogState.UI.CurrentFileLabel.Text = "Starting..."

                    # Update status label
                    foreach ($child in $script:DialogState.UI.StatusPanel.Children) {
                        if ($child.Tag -eq $item.Name) {
                            $child.Text = [char]0x21BB + " " + $item.Name + " (In progress...)"
                            $child.Foreground = [System.Windows.Media.Brushes]::Blue
                        }
                    }

                    # Check source exists
                    if (-not (Test-Path $item.SourcePath)) {
                        $script:DialogState.Results += @{
                            Name = $item.Name
                            Success = $false
                            Skipped = $true
                            Message = "Not in backup"
                            SizeBytes = 0
                            FileCount = 0
                            FolderCount = 0
                        }

                        foreach ($child in $script:DialogState.UI.StatusPanel.Children) {
                            if ($child.Tag -eq $item.Name) {
                                $child.Text = [char]0x25CB + " " + $item.Name + " (Skipped - not in backup)"
                                $child.Foreground = [System.Windows.Media.Brushes]::Gray
                            }
                        }

                        $script:DialogState.CurrentItemIndex++
                        return  # Stay in Starting state, will process next item on next tick
                    }

                    # Start robocopy (non-blocking)
                    $processInfo = Start-RobocopyProcess `
                        -Source $item.SourcePath `
                        -Destination $item.TargetPath `
                        -IsFile:($item.Type -eq "File")

                    $script:DialogState.CurrentProcess = $processInfo.Process
                    $script:DialogState.OutputTempFile = $processInfo.OutputFile
                    $script:DialogState.ErrorTempFile = $processInfo.ErrorFile
                    $script:DialogState.ProcessStartTime = $processInfo.StartTime

                    $script:DialogState.CopyState = "Running"
                }

                "Running" {
                    # Check if process is still running
                    if ($null -eq $script:DialogState.CurrentProcess) {
                        $script:DialogState.CopyState = "Starting"
                        return
                    }

                    # Check for timeout
                    $processElapsed = (Get-Date) - $script:DialogState.ProcessStartTime
                    $timeoutMs = $script:RobocopyTimeoutMinutes * 60 * 1000
                    if ($processElapsed.TotalMilliseconds -ge $timeoutMs) {
                        try {
                            $script:DialogState.CurrentProcess.Kill()
                            $script:DialogState.CurrentProcess.WaitForExit(5000)
                        } catch { }
                        $script:DialogState.CopyState = "ProcessComplete"
                        $script:DialogState.ProcessTimedOut = $true
                        return
                    }

                    if ($script:DialogState.CurrentProcess.HasExited) {
                        $script:DialogState.CopyState = "ProcessComplete"
                        $script:DialogState.ProcessTimedOut = $false
                    } else {
                        # Still running - update file progress label
                        $currentFile = Get-CurrentRobocopyFile -OutputFile $script:DialogState.OutputTempFile
                        if ($currentFile) {
                            $script:DialogState.UI.CurrentFileLabel.Text = $currentFile
                        }
                        $script:DialogState.UI.ItemProgress.IsIndeterminate = $true
                    }
                }

                "ProcessComplete" {
                    $script:DialogState.UI.ItemProgress.IsIndeterminate = $false

                    $idx = $script:DialogState.CurrentItemIndex
                    $selected = $script:DialogState.SelectedItems[$idx]
                    $item = $selected.Item

                    # Complete the robocopy process
                    $result = Complete-RobocopyProcess `
                        -Process $script:DialogState.CurrentProcess `
                        -OutputFile $script:DialogState.OutputTempFile `
                        -ErrorFile $script:DialogState.ErrorTempFile `
                        -StartTime $script:DialogState.ProcessStartTime `
                        -TimedOut:$script:DialogState.ProcessTimedOut

                    # Get actual stats
                    $stats = Get-PathStats -Path $item.TargetPath

                    # Record result (including FailedFiles for email reporting)
                    $script:DialogState.Results += @{
                        Name = $item.Name
                        Success = $result.Success
                        Skipped = $false
                        Message = $result.Message
                        SizeBytes = $stats.SizeBytes
                        FileCount = $stats.FileCount
                        FolderCount = $stats.FolderCount
                        Duration = if ($result.Duration) { Format-TimeSpan $result.Duration } else { "" }
                        FailedFiles = if ($result.FailedFiles) { $result.FailedFiles } else { @() }
                    }

                    # Update status label
                    foreach ($child in $script:DialogState.UI.StatusPanel.Children) {
                        if ($child.Tag -eq $item.Name) {
                            $icon = if ($result.Success) { [char]0x2714 } else { [char]0x2718 }
                            $color = if ($result.Success) { [System.Windows.Media.Brushes]::Green } else { [System.Windows.Media.Brushes]::Red }
                            $child.Text = "$icon $($item.Name) ($(Format-Bytes $stats.SizeBytes))"
                            $child.Foreground = $color
                        }
                    }

                    # Update progress
                    $script:DialogState.UI.OverallProgress.Value = [Math]::Round((($idx + 1) / [Math]::Max(1, $script:DialogState.TotalItems)) * 100)
                    $script:DialogState.UI.OverallProgressText.Text = "$([Math]::Round((($idx + 1) / [Math]::Max(1, $script:DialogState.TotalItems)) * 100))%"
                    $script:DialogState.UI.ItemProgress.Value = 100
                    $script:DialogState.UI.CurrentFileLabel.Text = "Complete"

                    # Move to next item
                    $script:DialogState.CurrentItemIndex++
                    $script:DialogState.CurrentProcess = $null
                    $script:DialogState.OutputTempFile = $null
                    $script:DialogState.ErrorTempFile = $null
                    $script:DialogState.CopyState = "Starting"
                }

                "AllComplete" {
                    # IMMEDIATELY record end time for accurate duration (Issue 1 fix)
                    $script:DialogState.Timer.Stop()
                    $script:DialogState.Stopwatch.Stop()
                    $script:DialogState.IsRunning = $false
                    $script:EndTime = Get-Date  # Record ACTUAL restore completion time
                    $script:DialogState.ActualDuration = $script:DialogState.Stopwatch.Elapsed

                    $successCount = @($script:DialogState.Results | Where-Object { $_.Success }).Count
                    $failedCount = @($script:DialogState.Results | Where-Object { -not $_.Success -and -not $_.Skipped }).Count

                    # Store results
                    $script:RestoreResults = $script:DialogState.Results

                    # === Issue 2 Fix: Send email BEFORE showing completion panel ===
                    if (-not $script:WhatIfMode -and -not $script:SkipEmailNotification) {
                        try {
                            Send-RestoreNotificationEmail -BackupPath $script:SelectedBackupPath `
                                -Results $script:DialogState.Results `
                                -StartTime $script:StartTime `
                                -EndTime $script:EndTime `
                                -OriginalMachine $script:Metadata.MachineName `
                                -RestoreMachine $env:COMPUTERNAME `
                                -UserName $env:USERNAME
                        } catch {
                            Write-Log "Email notification failed: $_" -Level Error
                        }
                    }

                    # === Now show completion panel for user review ===

                    $script:DialogState.UI.ProgressPanel.Visibility = [System.Windows.Visibility]::Collapsed
                    $script:DialogState.UI.CompletePanel.Visibility = [System.Windows.Visibility]::Visible

                    if ($failedCount -eq 0) {
                        $script:DialogState.UI.CompleteTitle.Text = "Restore Complete"
                        $script:DialogState.UI.CompleteTitle.Foreground = [System.Windows.Media.Brushes]::Green
                    } else {
                        $script:DialogState.UI.CompleteTitle.Text = "Restore Completed with Errors"
                        $script:DialogState.UI.CompleteTitle.Foreground = [System.Windows.Media.Brushes]::Orange
                    }

                    $script:DialogState.UI.CompleteStatus.Text = "Successful: $successCount | Failed: $failedCount"
                    $script:DialogState.UI.CompleteDuration.Text = "Duration: " + (Format-TimeSpan $script:DialogState.ActualDuration)

                    # Populate results
                    $script:DialogState.UI.ResultsPanel.Children.Clear()
                    foreach ($result in $script:DialogState.Results) {
                        $resultText = New-Object System.Windows.Controls.TextBlock
                        $icon = if ($result.Success) { [char]0x2714 } elseif ($result.Skipped) { [char]0x25CB } else { [char]0x2718 }
                        $color = if ($result.Success) { [System.Windows.Media.Brushes]::Green } elseif ($result.Skipped) { [System.Windows.Media.Brushes]::Gray } else { [System.Windows.Media.Brushes]::Red }
                        $resultText.Text = "$icon $($result.Name) - $(Format-Bytes $result.SizeBytes)"
                        $resultText.Foreground = $color
                        $resultText.Margin = [System.Windows.Thickness]::new(0, 3, 0, 3)
                        $script:DialogState.UI.ResultsPanel.Children.Add($resultText)
                    }

                    Play-CompletionSound

                    $script:DialogState.CopyState = "Done"
                }

                "Done" {
                    # Nothing to do
                }
            }
        })

        $script:DialogState.Timer.Start()
    })

    $window.ShowDialog() | Out-Null

    return @{
        Completed = ($script:DialogState.Results.Count -gt 0)
        Results = $script:DialogState.Results
        Cancelled = $script:DialogState.IsCancelled
    }
}

#endregion

#region Main Execution
# =============================================================================
# MAIN EXECUTION
# =============================================================================
# Script entry point. Execution flow:
# 1. Display banner and record start time
# 2. Get backup folder path (from -Path parameter OR FolderBrowserDialog)
# 3. Load and validate BackupMetadata.json from backup folder
# 4. Build restore items list from metadata
# 5. Initialize log file in backup folder
# 6. Display WPF selection dialog for user to choose items
# 7. Timer-driven state machine processes selected items via robocopy
# 8. On completion: record end time, send email notification
# 9. Display completion panel with results
# 10. Clean up (flush logs, stop transcript)
#
# Protocol Handler Support:
# The -Path parameter enables the fak:// URL scheme to launch restore directly.
# When user clicks restore link in email, Windows passes the URL to this script.
# The script extracts and URL-decodes the path, bypassing the folder browser.
#
# Key Global Variables Set:
# - $script:StartTime: Recorded when restore begins
# - $script:EndTime: Recorded immediately when restore completes (not on dialog close)
# - $script:SelectedBackupPath: Path for email function access
# - $script:WhatIfMode/$script:SkipEmailNotification: Flags for state machine
# =============================================================================

try {
    Write-Output "=== File Restore ==="
    Write-Output "[INFO] Started at: $(Get-Date -Format 'MM-dd-yyyy hh:mmtt')"
    Write-Output ""

    $script:StartTime = Get-Date

    Write-Log "Script started"
    Write-Log "  Version: $script:RestoreVersion"
    Write-Log "  WhatIf mode: $WhatIf"
    Write-Log "  Computer: $env:COMPUTERNAME"
    Write-Log "  User: $env:USERNAME"

    # Test network access
    if (-not (Test-NetworkAccess -Path $script:NetworkSharePath -MaxRetries $script:MaxRetries -RetryDelay $script:RetryDelaySeconds)) {
        throw "Cannot access network share: $script:NetworkSharePath"
    }

    # Get backup folder
    Write-LogSection "Selecting Backup Folder"

    if ($Path) {
        Write-Log "Using provided backup path: $Path"
        $selectedBackup = $Path
    } else {
        Write-Log "Opening folder browser..."
        $selectedBackup = Show-FolderBrowser -StartPath $script:NetworkSharePath

        if (-not $selectedBackup) {
            Write-Log "No backup folder selected. Exiting." -Level Warning
            exit 0
        }
    }

    Write-Log "Selected backup: $selectedBackup"

    # Store script-scope variables for access inside timer handler (Issue 2 fix)
    $script:SelectedBackupPath = $selectedBackup
    $script:WhatIfMode = $WhatIf
    $script:SkipEmailNotification = $SkipEmail

    if (-not (Test-Path $selectedBackup)) {
        throw "Backup folder does not exist: $selectedBackup"
    }

    # Load metadata
    Write-LogSection "Loading Backup Metadata"

    $script:Metadata = Get-BackupMetadata -BackupPath $selectedBackup

    if (-not $script:Metadata) {
        throw "Could not load backup metadata from: $selectedBackup"
    }

    Write-Log "Metadata loaded successfully" -Level Success
    Write-Log "  Backup Name: $($script:Metadata.BackupName)"
    Write-Log "  Backup Date: $($script:Metadata.BackupDate)"
    Write-Log "  Machine: $($script:Metadata.MachineName)"

    if ($script:Metadata.MachineName -ne $env:COMPUTERNAME) {
        Write-Log "WARNING: Restoring from different machine!" -Level Warning
    }

    # Build restore items
    Write-LogSection "Building Restore Items"

    $restoreItems = Get-RestoreItems -Metadata $script:Metadata -BackupPath $selectedBackup

    # Initialize logging
    if (-not $WhatIf) {
        $script:LogFile = Join-Path $selectedBackup "RestoreLog.txt"
        $transcriptPath = Join-Path $selectedBackup "RestoreTranscript.txt"
        Start-Transcript -Path $transcriptPath -Force | Out-Null
    }

    # Show WPF dialog
    $dialogResult = Show-WpfRestoreDialog -Metadata $script:Metadata -Items $restoreItems -BackupPath $selectedBackup -WhatIf:$WhatIf

    if (-not $dialogResult.Completed -or $dialogResult.Cancelled) {
        Write-Log "Restore cancelled by user" -Level Warning
        exit 0
    }

    # Note: EndTime is now set in AllComplete handler for accurate duration (Issue 1 fix)
    # Email is also sent in AllComplete handler before panel shows (Issue 2 fix)
    $duration = $script:EndTime - $script:StartTime

    # Stop transcript
    if (-not $WhatIf) {
        Stop-TranscriptSafe
    }

    # Calculate statistics for summary
    $successResults = @($dialogResult.Results | Where-Object { $_.Success })
    $successCount = $successResults.Count
    $failedCount = @($dialogResult.Results | Where-Object { -not $_.Success -and -not $_.Skipped }).Count
    $totalSize = Get-SafeSum -Items $successResults -Property SizeBytes

    Write-Output ""
    Write-Output "=== Summary ==="
    Write-Output "Items processed: $($dialogResult.Results.Count)"
    Write-Output "Successful: $successCount | Failed: $failedCount"
    Write-Output "Total size: $(Format-Bytes $totalSize)"
    Write-Output ""
    Write-Output "Completed at: $(Get-Date -Format 'MM-dd-yyyy hh:mm:ss tt')"
    Write-Output "Status: $(if ($failedCount -eq 0) { 'SUCCESS' } else { 'COMPLETED WITH ERRORS' })"

    Flush-LogBuffer

    # Prompt for deletion if requested
    if ($PromptForDeletion -and -not $WhatIf) {
        $deleteResult = [System.Windows.MessageBox]::Show(
            "Restore completed successfully.`n`nDo you want to DELETE the backup folder?`n`n$selectedBackup`n`nThis action cannot be undone!",
            "Delete Backup Folder?",
            [System.Windows.MessageBoxButton]::YesNo,
            [System.Windows.MessageBoxImage]::Warning
        )

        if ($deleteResult -eq [System.Windows.MessageBoxResult]::Yes) {
            Write-Log "User confirmed deletion of backup folder" -Level Warning
            try {
                Get-ChildItem -Path $selectedBackup -Recurse -Force -ErrorAction SilentlyContinue |
                    ForEach-Object {
                        if ($_.Attributes -band [System.IO.FileAttributes]::ReadOnly) {
                            $_.Attributes = $_.Attributes -bxor [System.IO.FileAttributes]::ReadOnly
                        }
                    }

                Remove-Item -Path $selectedBackup -Recurse -Force -ErrorAction Stop
                Write-Log "Backup folder deleted successfully" -Level Success

                [System.Windows.MessageBox]::Show(
                    "Backup folder deleted successfully.",
                    "Deleted",
                    [System.Windows.MessageBoxButton]::OK,
                    [System.Windows.MessageBoxImage]::Information
                ) | Out-Null
            } catch {
                Write-Log "Failed to delete backup folder: $_" -Level Error
                [System.Windows.MessageBox]::Show(
                    "Failed to delete backup folder:`n`n$_",
                    "Delete Failed",
                    [System.Windows.MessageBoxButton]::OK,
                    [System.Windows.MessageBoxImage]::Error
                ) | Out-Null
            }
        }
    }

} catch {
    Write-Log "FATAL ERROR: $_" -Level Error
    Write-Log "Stack trace: $($_.ScriptStackTrace)" -Level Error

    Flush-LogBuffer
    Stop-TranscriptSafe

    Write-Output ""
    Write-Output "[ERROR] Restore failed: $_"
    Write-Output "Status: FAILED"

    [System.Windows.MessageBox]::Show(
        "Restore failed with error:`n`n$_`n`nSee log for details.",
        "FAK Restore Error",
        [System.Windows.MessageBoxButton]::OK,
        [System.Windows.MessageBoxImage]::Error
    ) | Out-Null

    exit 1
}

#endregion
