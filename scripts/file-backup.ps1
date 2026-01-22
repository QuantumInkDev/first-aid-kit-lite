#Requires -Version 5.1
<#
.SYNOPSIS
    Backs up user profile data to network share with WPF progress dialog.

.DESCRIPTION
    Backs up user profile data (Documents, Desktop, Pictures, Signatures, etc.)
    directly to \\virfsit1\share32 with verification, progress tracking, detailed
    summary reports, and email notification. Features WPF-based UI for smooth
    animations and modern appearance.

    V3.09 FIX: Fixed null-value errors from Measure-Object on empty collections
    - Added Get-SafeSum helper function for safe sum calculations
    - Fixed email notification errors when results contained null values
    - Fixed metadata JSON generation with proper numeric defaults

.PARAMETER WhatIf
    Dry run mode - shows what would be copied without making changes.

.PARAMETER Verbose
    Shows detailed debug logging in console output.

.PARAMETER SkipEmail
    Skip sending the email notification at the end.

.PARAMETER PromptForDeletion
    After backup completes, prompts the user to delete the backup folder.

.EXAMPLE
    .\file-backup.ps1
    Runs the backup with user confirmation and email notification.

.EXAMPLE
    .\file-backup.ps1 -WhatIf
    Shows what would be backed up without copying.

.EXAMPLE
    .\file-backup.ps1 -SkipEmail
    Runs backup without sending email notification.

.NOTES
    Name: file-backup.ps1
    Author: Justin Garcia, Horizon BCBSNJ
    Version: 3.09
#>

[CmdletBinding()]
param(
    [switch]$WhatIf,
    [switch]$SkipEmail,
    [switch]$PromptForDeletion
)

## House Keeping -------------------------------------------------------------------------------------#
# NOTE: Removed "Remove-Variable *" as it wipes out script parameters passed via command line
Remove-Module *; $Error.Clear() | Out-Null; Clear-Host

# Debug: Log the incoming parameters
Write-Host "[DEBUG] Script parameters received:" -ForegroundColor Yellow
Write-Host "  WhatIf: $WhatIf" -ForegroundColor Yellow
Write-Host "  SkipEmail: $SkipEmail" -ForegroundColor Yellow
Write-Host "  PromptForDeletion: $PromptForDeletion" -ForegroundColor Yellow

#region Configuration
# =============================================================================
# CONFIGURATION SECTION
# =============================================================================
# Modify these values to customize backup behavior for your environment.
# All paths, timeouts, and exclusions can be adjusted here.
# =============================================================================

# Network share where backups are stored
# Format: \\server\share - must be accessible by the user running the script
$script:NetworkSharePath = "\\virfsit1\share32"

# Script version identifier - displayed in UI and emails
$script:BackupVersion = "3.09"

# Network connectivity settings
$script:MaxRetries = 5              # Number of times to retry network access
$script:RetryDelaySeconds = 5       # Seconds to wait between retry attempts

# Disk space safety margin (1.2 = require 20% more space than needed)
$script:DiskSpaceMargin = 1.2

# Robocopy performance settings
$script:RobocopyThreads = 8                 # Multi-threaded copy (/MT:n)
$script:RobocopyTimeoutMinutes = 240        # Max time per backup item (4 hours)

# Email Configuration
# Set EmailCC/EmailBCC to send copies of all backup notifications
$script:EmailCC = "IT_Deployment@horizonblue.com"
$script:EmailBCC = ""  # Example: "admin@company.com"

# Protocol Handler Configuration
# This URL scheme is used in email restore links
# When clicked, it launches the restore script with the backup path
# NOTE: 'Path' must match the case of the parameter in file-restore.json
$script:RestoreProtocol = "fak://run/file-restore?Path="

# Directory Exclusions - these folders will NOT be backed up
# Includes cache directories, temporary files, and other non-essential data
$script:ExcludedDirs = @(
    'Temp', 'tmp', 'Cache', 'Caches', 'INetCache',
    'Temporary Internet Files', 'CacheStorage', 'Code Cache',
    'GPUCache', 'Service Worker', '*_BU_*',
    'OneDriveTemp', '.tmp.drivedownload', '.tmp.driveupload'
)

# File Exclusions - these file patterns will NOT be backed up
$script:ExcludedFiles = @('*.tmp', '*.temp', 'Thumbs.db', 'desktop.ini', '*.log', '~$*')

# Script-level State Variables
# These are initialized during execution and used across functions
$script:LogFile = $null                                    # Path to log file (set after backup folder created)
$script:LogBuffer = [System.Collections.ArrayList]::new()  # Buffered log entries
$script:BackupResults = @()                                # Results from backup operations
$script:StartTime = $null                                  # Backup start timestamp
$script:EndTime = $null                                    # Backup end timestamp (set in AllComplete)
$script:BackupPath = $null                                 # Full path to current backup folder
#endregion

#region WPF Assemblies
# =============================================================================
# WPF ASSEMBLIES
# =============================================================================
# Load .NET assemblies required for the WPF-based user interface.
# These provide the modern UI framework used by the backup dialog.
# =============================================================================
Add-Type -AssemblyName PresentationFramework   # WPF core (Window, Button, etc.)
Add-Type -AssemblyName PresentationCore        # WPF rendering and input
Add-Type -AssemblyName WindowsBase             # WPF base classes (DispatcherTimer)
Add-Type -AssemblyName System.Windows.Forms    # Used for folder browser dialog
#endregion

#region Helper Functions
# =============================================================================
# HELPER FUNCTIONS
# =============================================================================
# Utility functions used throughout the script for logging, formatting,
# file operations, and other common tasks.
# =============================================================================

# -----------------------------------------------------------------------------
# Write-Log: Writes timestamped log messages to console and/or file
# Supports multiple log levels with color-coded console output
# -----------------------------------------------------------------------------
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
        } catch {
            Write-Log "Failed to flush log buffer: $_" -Level Warning -NoFile
        }
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

function Get-PathSizeBytes {
    param(
        [string]$Path,
        [switch]$IsFile
    )

    if (-not (Test-Path $Path)) { return 0 }

    if ($IsFile) {
        return (Get-Item $Path -ErrorAction SilentlyContinue).Length
    }

    $items = Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue
    return (Get-SafeSum -Items $items -Property Length)
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
            Write-Log "  Response time: $($testDuration.TotalMilliseconds.ToString('N0'))ms"
            return $true
        }

        Write-Log "  FAILED - share not accessible" -Level Warning

        if ($i -lt $MaxRetries) {
            Write-Log "  Waiting $RetryDelay seconds before retry..." -Level Warning
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
        2  { "Extra files detected at destination" }
        3  { "Files copied, extra files detected" }
        4  { "Mismatched files detected" }
        5  { "Files copied, mismatched files detected" }
        6  { "Extra and mismatched files detected" }
        7  { "Files copied, extra and mismatched detected" }
        8  { "Some files could not be copied (retries exceeded)" }
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

function Get-NetworkShareFreeSpace {
    param([string]$Path)

    try {
        if ($Path -match '^(\\\\[^\\]+\\[^\\]+)') {
            $uncRoot = $Matches[1]
            $drive = New-Object -ComObject Scripting.FileSystemObject
            $driveInfo = $drive.GetDrive($uncRoot)
            return $driveInfo.AvailableSpace
        }
    } catch {
        Write-Log "Could not determine free space: $_" -Level Warning
    }

    return [long]::MaxValue
}

function Play-CompletionSound {
    try {
        [System.Media.SystemSounds]::Exclamation.Play()
        Write-Log "Played completion sound" -Level Debug
    } catch {
        Write-Log "Could not play completion sound: $_" -Level Warning
    }
}

function Get-UrlEncodedPath {
    param([string]$Path)
    return [System.Uri]::EscapeDataString($Path)
}

# -----------------------------------------------------------------------------
# Send-NotificationEmail: Sends backup completion email via Outlook COM
# Creates HTML email with:
#   - Quick Restore link at top (prominent, large button)
#   - Status badge (SUCCESS or COMPLETED WITH ERRORS)
#   - Statistics grid (duration, size, file count)
#   - Backup details table
#   - Item results table
#   - Failed files section (if any files couldn't be copied)
# -----------------------------------------------------------------------------
function Send-NotificationEmail {
    param(
        [string]$BackupPath,      # Full path to backup folder
        [array]$Results,          # Array of item results with Success, SizeBytes, etc.
        [datetime]$StartTime,     # When backup started
        [datetime]$EndTime,       # When backup completed (ACTUAL time, not dialog close)
        [string]$MachineName,     # Computer name
        [string]$UserName         # User name
    )

    Write-LogSection "Sending Email Notification"

    try {
        # Create Outlook COM object
        $outlook = New-Object -ComObject Outlook.Application
        $mail = $outlook.CreateItem(0)

        # Get user's email address
        $session = $outlook.Session
        $currentUser = $session.CurrentUser
        $userEmail = $currentUser.Address

        if (-not $userEmail -or $userEmail -notmatch '@') {
            # Try to get from default account
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

        # Calculate statistics
        $duration = $EndTime - $StartTime
        $successResults = @($Results | Where-Object { $_.Success -eq $true })
        $successCount = $successResults.Count
        $failedCount = @($Results | Where-Object { $_.Success -eq $false -and $_.Skipped -eq $false }).Count
        $skippedCount = @($Results | Where-Object { $_.Skipped -eq $true }).Count
        $totalSize = Get-SafeSum -Items $successResults -Property SizeBytes
        $totalFiles = Get-SafeSum -Items $successResults -Property FileCount

        # Build restore link
        $encodedPath = Get-UrlEncodedPath -Path $BackupPath
        $restoreLink = "$($script:RestoreProtocol)$encodedPath"

        # Build HTML email body
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

        # Failed items detail (Issue 4: Include individual FailedFiles)
        $failedHtml = ""
        $failedItems = @($Results | Where-Object { $_.Success -eq $false -and $_.Skipped -eq $false })
        if ($failedItems.Count -gt 0) {
            $failedHtml = @"
            <h3 style="color: #dc3545; margin-top: 20px;">Failed Items</h3>
            <ul style="color: #dc3545;">
"@
            foreach ($item in $failedItems) {
                $failedHtml += "<li><strong>$($item.Name)</strong>: $($item.Message)</li>`n"
            }
            $failedHtml += "</ul>"
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
                <p style="margin: 0 0 10px 0; color: #721c24; font-weight: bold;">&#9888; Failed Files ($($allFailedFiles.Count) file(s) could not be copied):</p>
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
        .header { background-color: #0078d4; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
        .footer { background-color: #e9ecef; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
        .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; color: white; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0; }
        .stat-box { background: white; padding: 10px; border-radius: 5px; border: 1px solid #dee2e6; }
        .stat-label { font-size: 12px; color: #6c757d; }
        .stat-value { font-size: 18px; font-weight: bold; color: #0078d4; }
        table { width: 100%; border-collapse: collapse; background: white; margin-top: 15px; }
        th { background-color: #0078d4; color: white; padding: 10px; text-align: left; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0;">FAK Backup Complete</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">$($StartTime.ToString("dddd, MMMM d, yyyy 'at' h:mm tt"))</p>
        </div>

        <div class="content">
            <!-- Issue 3: RESTORE LINK AT TOP - Prominent and easy to find -->
            <div style="background: #28a745; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
                <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: white;">&#128190; Quick Restore</p>
                <a href="$restoreLink" style="display: inline-block; background: white; color: #28a745; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold;">Click to Restore Files</a>
                <p style="margin: 15px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.8);">$restoreLink</p>
            </div>

            <p><span class="status-badge" style="background-color: $statusColor;">$statusText</span></p>

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
                    <div class="stat-label">Files Backed Up</div>
                    <div class="stat-value">$($totalFiles.ToString("N0"))</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Items</div>
                    <div class="stat-value">$successCount OK / $failedCount Failed</div>
                </div>
            </div>

            <h3 style="margin-top: 20px;">Backup Details</h3>
            <table>
                <tr><td style="padding: 5px; width: 120px;"><strong>Machine:</strong></td><td>$MachineName</td></tr>
                <tr><td style="padding: 5px;"><strong>User:</strong></td><td>$UserName</td></tr>
                <tr><td style="padding: 5px;"><strong>Backup Path:</strong></td><td style="word-break: break-all;">$BackupPath</td></tr>
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

            $failedHtml

            $failedFilesHtml

            <!-- Backup restore link at bottom as fallback -->
            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin-top: 20px;">
                <p style="margin: 0 0 10px 0;"><strong>Your backup is complete!</strong></p>
                <p style="margin: 0; font-size: 12px; color: #155724;">Restore link: <a href="$restoreLink" style="color: #155724;">$restoreLink</a></p>
            </div>
        </div>

        <div class="footer">
            <p style="margin: 0;">FAK (First Aid Kit) Backup Script V$($script:BackupVersion)</p>
            <p style="margin: 5px 0 0 0;">This is an automated notification. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
"@

        # Configure email
        $mail.To = $userEmail
        $mail.Subject = "FAK Backup Complete - $MachineName - $($StartTime.ToString('yyyy-MM-dd'))"
        $mail.HTMLBody = $htmlBody

        # Add CC if configured
        if ($script:EmailCC) {
            $mail.CC = $script:EmailCC
            Write-Log "CC: $($script:EmailCC)" -Level Debug
        }

        # Add BCC if configured
        if ($script:EmailBCC) {
            $mail.BCC = $script:EmailBCC
            Write-Log "BCC: $($script:EmailBCC)" -Level Debug
        }

        # Send email
        $mail.Send()
        Write-Log "Email notification sent successfully" -Level Success

        # Release COM objects
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($mail) | Out-Null
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($outlook) | Out-Null

        return $true

    } catch {
        Write-Log "Failed to send email notification: $_" -Level Error

        # Show popup notification about email failure
        [System.Windows.MessageBox]::Show(
            "The backup completed successfully, but the email notification could not be sent.`n`nError: $_",
            "Email Notification Failed",
            [System.Windows.MessageBoxButton]::OK,
            [System.Windows.MessageBoxImage]::Warning
        ) | Out-Null

        return $false
    }
}

#endregion

#region Non-Blocking Robocopy Functions (V3.08 Fix)
# =============================================================================
# NON-BLOCKING ROBOCOPY FUNCTIONS
# =============================================================================
# V3.08 introduced these functions to replace the blocking robocopy loop.
# Instead of waiting for robocopy to complete (which freezes the UI), these
# functions start robocopy as a background process and check its status
# periodically via the timer-driven state machine.
#
# Benefits:
#   - UI remains responsive (elapsed timer updates, cancel works)
#   - Shows current file being copied
#   - No infinite loops from closure variable capture issues
# =============================================================================

# -----------------------------------------------------------------------------
# Start-RobocopyProcess: Launches robocopy and returns immediately
# Returns a hashtable with Process, OutputFile, ErrorFile, and StartTime
# The caller monitors the process via the state machine timer
# -----------------------------------------------------------------------------
function Start-RobocopyProcess {
    <#
    .SYNOPSIS
        Starts robocopy process and returns immediately (non-blocking).
        Returns process object and temp file path for monitoring.
    #>
    param(
        [string]$Source,
        [string]$Destination,
        [switch]$IsFile,
        [string]$FileFilter = $null
    )

    Write-Log "Start-RobocopyProcess: Launching robocopy (non-blocking)" -Level Debug
    Write-Log "  Source: $Source" -Level Debug
    Write-Log "  Destination: $Destination" -Level Debug

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

    foreach ($dir in $script:ExcludedDirs) {
        $robocopyParams += "/XD"
        $robocopyParams += "`"$dir`""
    }

    foreach ($file in $script:ExcludedFiles) {
        $robocopyParams += "/XF"
        $robocopyParams += "`"$file`""
    }

    if ($IsFile) {
        $sourceDir = Split-Path $Source -Parent
        $fileName = Split-Path $Source -Leaf

        if ($FileFilter) {
            $robocopyArgs = "`"$sourceDir`" `"$Destination`" `"$FileFilter`" $($robocopyParams -join ' ')"
        } else {
            $robocopyArgs = "`"$sourceDir`" `"$Destination`" `"$fileName`" $($robocopyParams -join ' ')"
        }
    } else {
        $robocopyParams += '/E'
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
        # Robocopy output formats: "New File", "Newer", "Older", etc. followed by file path
        for ($i = $content.Count - 1; $i -ge 0; $i--) {
            $line = $content[$i]
            # Match lines like "  New File  1234567  filename.ext" or "  100%  filename.ext"
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

#region Backup Items Definition
# =============================================================================
# BACKUP ITEMS DEFINITION
# =============================================================================
# Defines what user data to back up. Each item specifies:
#   - Name: Display name shown in UI
#   - Source: Full path to source location
#   - Type: "Directory" or "File"
#   - Critical: Whether item is pre-selected by default
#   - FileFilter: (Optional) Wildcard pattern for file backups
#
# To add new items, add entries to the array returned by Get-BackupItems.
# Items that don't exist on the system are shown as disabled in the UI.
# =============================================================================

function Get-BackupItems {
    $userProfile = $env:USERPROFILE
    $appData = $env:APPDATA
    $localAppData = $env:LOCALAPPDATA

    return @(
        @{
            Name = "Documents"
            Source = Join-Path $userProfile "Documents"
            Type = "Directory"
            Critical = $true
        },
        @{
            Name = "Desktop"
            Source = Join-Path $userProfile "Desktop"
            Type = "Directory"
            Critical = $true
        },
        @{
            Name = "Pictures"
            Source = Join-Path $userProfile "Pictures"
            Type = "Directory"
            Critical = $false
        },
        @{
            Name = "Avaya"
            Source = Join-Path $appData "Avaya"
            Type = "Directory"
            Critical = $false
        },
        @{
            Name = "Signatures"
            Source = Join-Path $appData "Microsoft\Signatures"
            Type = "Directory"
            Critical = $true
        },
        @{
            Name = "SAS"
            Source = Join-Path $appData "SAS"
            Type = "Directory"
            Critical = $false
        },
        @{
            Name = "RecentItems"
            Source = Join-Path $appData "Microsoft\Windows\Recent\AutomaticDestinations"
            Type = "File"
            FileFilter = "*.automaticDestinations-ms"
            Critical = $false
        },
        @{
            Name = "ChromeBookmarks"
            Source = Join-Path $localAppData "Google\Chrome\User Data\Default\Bookmarks"
            Type = "File"
            Critical = $false
        },
        @{
            Name = "EdgeBookmarks"
            Source = Join-Path $localAppData "Microsoft\Edge\User Data\Default\Bookmarks"
            Type = "File"
            Critical = $false
        },
        @{
            Name = "LotusNotesData"
            Source = Join-Path $localAppData "Lotus\Notes\Data"
            Type = "Directory"
            Critical = $false
        },
        @{
            Name = "OfficeDictionaries"
            Source = Join-Path $appData "Microsoft\UProof"
            Type = "Directory"
            FileFilter = "*.dic"
            Critical = $false
        }
    )
}

#endregion

#region WPF UI
# =============================================================================
# WPF USER INTERFACE
# =============================================================================
# Creates and manages the WPF-based backup dialog. The dialog has three panels:
#
# 1. SELECTION PANEL - Initial view where user selects items to backup
#    - Checkboxes for each backup item with size display
#    - Summary of selected items and total size
#    - Start and Cancel buttons
#
# 2. PROGRESS PANEL - Shown during backup operations
#    - Overall progress bar with percentage
#    - Current item being backed up
#    - Item progress bar (indeterminate during copy)
#    - Current file being copied
#    - Elapsed time (updates every second via timer)
#    - Status list showing completed items
#    - Cancel button
#
# 3. COMPLETION PANEL - Shown when backup completes
#    - Success/error title with color coding
#    - Summary statistics
#    - Results list for each item
#    - Close button
#
# The dialog uses a timer-driven state machine (V3.08) to keep the UI
# responsive during file operations. See STATE MACHINE section below.
# =============================================================================

function Show-WpfBackupDialog {
    param(
        [array]$Items,
        [string]$BackupPath,
        [switch]$WhatIf
    )

    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="FAK Backup V3.09$(if ($WhatIf) { ' - DRY RUN' } else { '' })"
        Height="650" Width="620"
        WindowStartupLocation="CenterScreen"
        ResizeMode="NoResize"
        Topmost="True"
        Background="#FFFFFF">
    <Window.Resources>
        <Style x:Key="ModernButton" TargetType="Button">
            <Setter Property="Background" Value="#0078D4"/>
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
                                <Setter Property="Background" Value="#106EBE"/>
                            </Trigger>
                            <Trigger Property="IsPressed" Value="True">
                                <Setter Property="Background" Value="#005A9E"/>
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
            <Setter Property="Foreground" Value="#0078D4"/>
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

            <!-- Header -->
            <StackPanel Grid.Row="0" Margin="20,20,20,10">
                <TextBlock Text="Select Items to Backup" FontSize="20" FontWeight="SemiBold" Foreground="#333"/>
                <TextBlock x:Name="BackupPathLabel" FontSize="12" Foreground="#666" Margin="0,5,0,0" TextWrapping="Wrap"/>
                <TextBlock x:Name="MachineInfoLabel" FontSize="12" Foreground="#888" Margin="0,3,0,0"/>
            </StackPanel>

            <!-- Items List -->
            <Border Grid.Row="1" Margin="20,10" BorderBrush="#E0E0E0" BorderThickness="1" CornerRadius="4">
                <ScrollViewer VerticalScrollBarVisibility="Auto">
                    <StackPanel x:Name="ItemsPanel" Margin="10"/>
                </ScrollViewer>
            </Border>

            <!-- Footer -->
            <Grid Grid.Row="2" Margin="20,10,20,20">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                    <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>

                <TextBlock x:Name="SummaryLabel" Grid.Column="0" VerticalAlignment="Center" FontWeight="SemiBold"/>
                <Button x:Name="CancelButton" Grid.Column="1" Content="Cancel" Style="{StaticResource CancelButton}" Margin="0,0,10,0"/>
                <Button x:Name="StartButton" Grid.Column="2" Content="Start Backup" Style="{StaticResource ModernButton}"/>
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

            <!-- Header -->
            <StackPanel Grid.Row="0" Margin="20,20,20,10">
                <TextBlock x:Name="ProgressTitle" Text="Backing Up Files..." FontSize="20" FontWeight="SemiBold" Foreground="#333"/>
                <TextBlock x:Name="ElapsedLabel" Text="Elapsed: 00:00:00" FontSize="14" Foreground="#666" Margin="0,5,0,0"/>
            </StackPanel>

            <!-- Progress Bars -->
            <StackPanel Grid.Row="1" Margin="20,10">
                <TextBlock Text="Overall Progress:" FontSize="12" Foreground="#666" Margin="0,0,0,5"/>
                <ProgressBar x:Name="OverallProgress" Style="{StaticResource ModernProgressBar}" Height="28"/>
                <TextBlock x:Name="OverallProgressText" Text="0%" HorizontalAlignment="Center" Margin="0,5,0,15" FontWeight="SemiBold"/>

                <TextBlock x:Name="CurrentItemLabel" Text="Current Item:" FontSize="12" Foreground="#666" Margin="0,0,0,5"/>
                <ProgressBar x:Name="ItemProgress" Style="{StaticResource ModernProgressBar}" Height="20" Foreground="#28A745"/>
                <TextBlock x:Name="CurrentFileLabel" Text="" FontSize="11" Foreground="#888" Margin="0,5,0,0" TextTrimming="CharacterEllipsis"/>
            </StackPanel>

            <!-- Status List -->
            <Border Grid.Row="2" Margin="20,10" BorderBrush="#E0E0E0" BorderThickness="1" CornerRadius="4">
                <ScrollViewer VerticalScrollBarVisibility="Auto">
                    <StackPanel x:Name="StatusPanel" Margin="10"/>
                </ScrollViewer>
            </Border>

            <!-- Cancel Button -->
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

            <!-- Header -->
            <StackPanel Grid.Row="0" Margin="20,20,20,10">
                <TextBlock x:Name="CompleteTitle" Text="Backup Complete" FontSize="20" FontWeight="SemiBold" Foreground="#28A745"/>
                <TextBlock x:Name="CompleteStatus" FontSize="14" Foreground="#666" Margin="0,5,0,0" TextWrapping="Wrap"/>
                <TextBlock x:Name="CompleteDuration" FontSize="12" Foreground="#888" Margin="0,5,0,0"/>
            </StackPanel>

            <!-- Results List -->
            <Border Grid.Row="1" Margin="20,10" BorderBrush="#E0E0E0" BorderThickness="1" CornerRadius="4">
                <ScrollViewer VerticalScrollBarVisibility="Auto">
                    <StackPanel x:Name="ResultsPanel" Margin="10"/>
                </ScrollViewer>
            </Border>

            <!-- Close Button -->
            <Button x:Name="CloseButton" Grid.Row="2" Content="Close"
                    Style="{StaticResource ModernButton}"
                    HorizontalAlignment="Right" Margin="20,10,20,20"/>
        </Grid>
    </Grid>
</Window>
"@

    # Parse XAML
    try {
        $reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml))
        $window = [System.Windows.Markup.XamlReader]::Load($reader)
    } catch {
        Write-Host "XAML Parse Error: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }

    # Get controls
    $selectionPanel = $window.FindName("SelectionPanel")
    $progressPanel = $window.FindName("ProgressPanel")
    $completePanel = $window.FindName("CompletePanel")

    $backupPathLabel = $window.FindName("BackupPathLabel")
    $machineInfoLabel = $window.FindName("MachineInfoLabel")
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

    # Debug: Check for null controls
    $nullControls = @()
    if ($null -eq $backupPathLabel) { $nullControls += "BackupPathLabel" }
    if ($null -eq $machineInfoLabel) { $nullControls += "MachineInfoLabel" }
    if ($null -eq $itemsPanel) { $nullControls += "ItemsPanel" }
    if ($null -eq $summaryLabel) { $nullControls += "SummaryLabel" }
    if ($null -eq $cancelButton) { $nullControls += "CancelButton" }
    if ($null -eq $startButton) { $nullControls += "StartButton" }
    if ($null -eq $elapsedLabel) { $nullControls += "ElapsedLabel" }
    if ($null -eq $overallProgressText) { $nullControls += "OverallProgressText" }
    if ($null -eq $currentItemLabel) { $nullControls += "CurrentItemLabel" }
    if ($null -eq $currentFileLabel) { $nullControls += "CurrentFileLabel" }
    if ($null -eq $completeTitle) { $nullControls += "CompleteTitle" }
    if ($null -eq $completeStatus) { $nullControls += "CompleteStatus" }
    if ($null -eq $completeDuration) { $nullControls += "CompleteDuration" }
    if ($nullControls.Count -gt 0) {
        throw "Failed to find controls: $($nullControls -join ', '). XAML may have failed to parse correctly."
    }

    # State - V3.08: Added state machine fields
    $script:DialogState = @{
        SelectedItems = @()
        Checkboxes = @{}
        IsRunning = $false
        IsCancelled = $false
        Results = @()
        Stopwatch = $null
        Timer = $null
        BackupPath = $BackupPath

        # V3.08 State Machine Fields
        CurrentItemIndex = 0
        CopyState = "Idle"           # Idle, Starting, Running, AllComplete, Cancelled
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
    $backupPathLabel.Text = "Destination: $BackupPath"
    $machineInfoLabel.Text = "$env:COMPUTERNAME - $env:USERNAME"

    # Create checkboxes for items
    foreach ($item in $Items) {
        $exists = Test-Path $item.Source
        $size = if ($exists) { Get-PathSizeBytes -Path $item.Source -IsFile:($item.Type -eq "File") } else { 0 }

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
        $checkbox.IsChecked = $exists
        $checkbox.IsEnabled = $exists
        $checkbox.Tag = @{ Item = $item; Size = $size; Exists = $exists }
        $checkbox.FontSize = 13

        if (-not $exists) {
            $checkbox.Foreground = [System.Windows.Media.Brushes]::Gray
            $checkbox.Content = "$($item.Name) (Not found)"
        }

        [System.Windows.Controls.Grid]::SetColumn($checkbox, 0)

        $sizeLabel = New-Object System.Windows.Controls.TextBlock
        $sizeLabel.Text = if ($exists) { Format-Bytes $size } else { "-" }
        $sizeLabel.Foreground = if ($exists) { [System.Windows.Media.Brushes]::Gray } else { [System.Windows.Media.Brushes]::LightGray }
        $sizeLabel.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Right
        $sizeLabel.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
        $sizeLabel.FontFamily = New-Object System.Windows.Media.FontFamily("Consolas")

        [System.Windows.Controls.Grid]::SetColumn($sizeLabel, 1)

        $grid.Children.Add($checkbox)
        $grid.Children.Add($sizeLabel)
        $itemsPanel.Children.Add($grid)

        $script:DialogState.Checkboxes[$item.Name] = $checkbox
    }

    # Update summary function
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

    # Wire up checkbox events
    foreach ($cb in $script:DialogState.Checkboxes.Values) {
        $cb.Add_Checked($updateSummary)
        $cb.Add_Unchecked($updateSummary)
    }

    # Initial summary update
    & $updateSummary

    # Cancel button
    $cancelButton.Add_Click({
        $window.DialogResult = $false
        $window.Close()
    })

    # Close button
    $closeButton.Add_Click({
        $window.DialogResult = $true
        $window.Close()
    })

    # Progress cancel
    $progressCancelButton.Add_Click({
        $script:DialogState.IsCancelled = $true
        $script:DialogState.CopyState = "Cancelled"
        if ($null -ne $script:DialogState.CurrentProcess -and -not $script:DialogState.CurrentProcess.HasExited) {
            try { $script:DialogState.CurrentProcess.Kill() } catch { }
        }
    })

    # Start button - V3.08: Simplified - just initializes state, timer handles the rest
    $startButton.Add_Click({
        # Gather selected items
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

        # Switch to progress panel
        $selectionPanel.Visibility = [System.Windows.Visibility]::Collapsed
        $progressPanel.Visibility = [System.Windows.Visibility]::Visible

        # Initialize status labels
        $statusPanel.Children.Clear()
        foreach ($selected in $script:DialogState.SelectedItems) {
            $statusText = New-Object System.Windows.Controls.TextBlock
            $statusText.Text = [char]0x25CB + " " + $selected.Item.Name + " (" + (Format-Bytes $selected.Size) + ")"
            $statusText.Foreground = [System.Windows.Media.Brushes]::LightGray
            $statusText.Margin = [System.Windows.Thickness]::new(0, 3, 0, 3)
            $statusText.Tag = $selected.Item.Name
            $statusPanel.Children.Add($statusText)
        }

        # V3.08: Initialize state machine
        $script:DialogState.IsRunning = $true
        $script:DialogState.Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $script:DialogState.Results = @()
        $script:DialogState.CurrentItemIndex = 0
        $script:DialogState.CopyState = "Starting"
        $script:DialogState.TotalItems = $script:DialogState.SelectedItems.Count
        $script:DialogState.CurrentProcess = $null
        $script:DialogState.OutputTempFile = $null
        $script:DialogState.ErrorTempFile = $null

        # Create timer - V3.08: Timer tick is now the state machine driver
        $script:DialogState.Timer = New-Object System.Windows.Threading.DispatcherTimer
        $script:DialogState.Timer.Interval = [TimeSpan]::FromMilliseconds(100)

        # V3.08: State machine tick handler
        $script:DialogState.Timer.Add_Tick({
            # Always update elapsed time first (never blocked!)
            $elapsed = $script:DialogState.Stopwatch.Elapsed
            $script:DialogState.UI.ElapsedLabel.Text = "Elapsed: " + ("{0:D2}:{1:D2}:{2:D2}" -f [int]$elapsed.TotalHours, $elapsed.Minutes, $elapsed.Seconds)

            # State machine
            switch ($script:DialogState.CopyState) {
                "Cancelled" {
                    # Handle cancellation
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
                    $script:DialogState.UI.CompleteTitle.Text = "Backup Cancelled"
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

                    # Prepare destination
                    $destPath = Join-Path $script:DialogState.BackupPath $item.Name
                    Ensure-Folder -Path $destPath | Out-Null

                    # Start robocopy (non-blocking)
                    $startParams = @{
                        Source = $item.Source
                        Destination = $destPath
                        IsFile = ($item.Type -eq "File")
                    }
                    if ($item.FileFilter) {
                        $startParams.FileFilter = $item.FileFilter
                    }

                    $processInfo = Start-RobocopyProcess @startParams
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
                        # Process timed out - handle completion with timeout flag
                        $script:DialogState.CopyState = "ProcessComplete"
                        $script:DialogState.ProcessTimedOut = $true
                        return
                    }

                    if ($script:DialogState.CurrentProcess.HasExited) {
                        # Process finished
                        $script:DialogState.CopyState = "ProcessComplete"
                        $script:DialogState.ProcessTimedOut = $false
                    } else {
                        # Still running - update file progress label
                        $currentFile = Get-CurrentRobocopyFile -OutputFile $script:DialogState.OutputTempFile
                        if ($currentFile) {
                            $script:DialogState.UI.CurrentFileLabel.Text = $currentFile
                        }
                        # Show indeterminate progress for item
                        $script:DialogState.UI.ItemProgress.IsIndeterminate = $true
                    }
                }

                "ProcessComplete" {
                    # Robocopy finished for current item - record result
                    $script:DialogState.UI.ItemProgress.IsIndeterminate = $false

                    $idx = $script:DialogState.CurrentItemIndex
                    $selected = $script:DialogState.SelectedItems[$idx]
                    $item = $selected.Item
                    $destPath = Join-Path $script:DialogState.BackupPath $item.Name

                    # Complete the robocopy process
                    $result = Complete-RobocopyProcess `
                        -Process $script:DialogState.CurrentProcess `
                        -OutputFile $script:DialogState.OutputTempFile `
                        -ErrorFile $script:DialogState.ErrorTempFile `
                        -StartTime $script:DialogState.ProcessStartTime `
                        -TimedOut:$script:DialogState.ProcessTimedOut

                    # Get actual stats
                    $stats = Get-PathStats -Path $destPath

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
                    # All items done - IMMEDIATELY record end time for accurate duration (Issue 1 fix)
                    $script:DialogState.Timer.Stop()
                    $script:DialogState.Stopwatch.Stop()
                    $script:DialogState.IsRunning = $false
                    $script:EndTime = Get-Date  # Record ACTUAL backup completion time, not dialog close time
                    $script:DialogState.ActualDuration = $script:DialogState.Stopwatch.Elapsed

                    $successCount = @($script:DialogState.Results | Where-Object { $_.Success }).Count
                    $failedCount = @($script:DialogState.Results | Where-Object { -not $_.Success -and -not $_.Skipped }).Count

                    # Store results for later
                    $script:BackupResults = $script:DialogState.Results

                    # === Issue 2 Fix: Save metadata and send email BEFORE showing completion panel ===

                    # Save metadata first
                    if (-not $script:WhatIfMode) {
                        try {
                            $duration = $script:EndTime - $script:StartTime
                            $metadata = @{
                                BackupName = $script:BackupName
                                BackupDate = $script:StartTime.ToString("o")
                                BackupVersion = $script:BackupVersion
                                MachineName = $env:COMPUTERNAME
                                UserName = $env:USERNAME
                                Duration = Format-TimeSpan $duration
                                Items = $script:DialogState.Results
                                Statistics = @{
                                    TotalItems = $script:DialogState.Results.Count
                                    SuccessfulItems = $successCount
                                    FailedItems = $failedCount
                                    TotalSizeBytes = Get-SafeSum -Items $script:DialogState.Results -Property SizeBytes
                                    TotalFiles = Get-SafeSum -Items $script:DialogState.Results -Property FileCount
                                }
                            }
                            $metadataPath = Join-Path $script:BackupPath "BackupMetadata.json"
                            $metadata | ConvertTo-Json -Depth 10 | Set-Content -Path $metadataPath -Encoding UTF8
                            Write-Log "Metadata saved: $metadataPath" -Level Success
                        } catch {
                            Write-Log "Failed to save metadata: $_" -Level Error
                        }
                    }

                    # Send email notification before showing panel
                    if (-not $script:SkipEmailNotification -and -not $script:WhatIfMode) {
                        try {
                            Send-NotificationEmail -BackupPath $script:BackupPath `
                                -Results $script:DialogState.Results `
                                -StartTime $script:StartTime `
                                -EndTime $script:EndTime `
                                -MachineName $env:COMPUTERNAME `
                                -UserName $env:USERNAME
                        } catch {
                            Write-Log "Email notification failed: $_" -Level Error
                        }
                    }

                    # === Now show completion panel for user review ===

                    $script:DialogState.UI.ProgressPanel.Visibility = [System.Windows.Visibility]::Collapsed
                    $script:DialogState.UI.CompletePanel.Visibility = [System.Windows.Visibility]::Visible

                    if ($failedCount -eq 0) {
                        $script:DialogState.UI.CompleteTitle.Text = "Backup Complete"
                        $script:DialogState.UI.CompleteTitle.Foreground = [System.Windows.Media.Brushes]::Green
                    } else {
                        $script:DialogState.UI.CompleteTitle.Text = "Backup Completed with Errors"
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

                    # Play sound
                    Play-CompletionSound

                    $script:DialogState.CopyState = "Done"
                }

                "Done" {
                    # Nothing to do, timer will be stopped
                }
            }
        })

        $script:DialogState.Timer.Start()
    })

    # Show window
    try {
        $window.ShowDialog() | Out-Null
    } catch {
        Write-Host "ShowDialog Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.InnerException) {
            Write-Host "Inner Exception: $($_.Exception.InnerException.Message)" -ForegroundColor Red
        }
        throw
    }

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
#
# 1. Display banner and record start time
# 2. Test network share accessibility (with retries)
# 3. Create backup folder on network share (COMPUTERNAME_BU_YYYY-MM-DD)
# 4. Initialize transcript logging
# 5. Get list of backup items and check which exist
# 6. Show WPF dialog for user to select items
# 7. [Dialog handles backup via state machine]
# 8. Stop transcript
# 9. Log completion summary
# 10. (Optional) Prompt for backup folder deletion
#
# Note: Metadata save and email notification now happen INSIDE the dialog's
# AllComplete state handler, BEFORE the completion panel is shown. This
# ensures accurate duration reporting (V3.08 fix).
# =============================================================================

try {
    # Display startup banner
    Write-Output "=== File Backup ==="
    Write-Output "[INFO] Started at: $(Get-Date -Format 'MM-dd-yyyy hh:mmtt')"
    Write-Output ""

    # Record backup start time (used for duration calculation)
    $script:StartTime = Get-Date

    Write-Log "Script started"
    Write-Log "  Version: $script:BackupVersion"
    Write-Log "  WhatIf mode: $WhatIf"
    Write-Log "  Computer: $env:COMPUTERNAME"
    Write-Log "  User: $env:USERNAME"
    Write-Log "  PowerShell version: $($PSVersionTable.PSVersion)"

    # Test network access
    if (-not (Test-NetworkAccess -Path $script:NetworkSharePath -MaxRetries $script:MaxRetries -RetryDelay $script:RetryDelaySeconds)) {
        throw "Cannot access network share: $script:NetworkSharePath"
    }

    # Create backup folder
    Write-LogSection "Creating Backup Folder"

    $backupName = "{0}_BU_{1}" -f $env:COMPUTERNAME, (Get-Date -Format "yyyy-MM-dd")
    $script:BackupPath = Join-Path $script:NetworkSharePath $backupName

    # Store script-scope variables for access inside timer handler (Issue 2 fix)
    $script:BackupName = $backupName
    $script:WhatIfMode = $WhatIf
    $script:SkipEmailNotification = $SkipEmail

    Write-Log "Backup folder: $script:BackupPath"

    if (-not $WhatIf) {
        if (Test-Path $script:BackupPath) {
            Write-Log "Backup folder already exists - will update" -Level Warning
        } else {
            Ensure-Folder -Path $script:BackupPath | Out-Null
            Write-Log "Created backup folder" -Level Success
        }
    }

    # Initialize logging
    if (-not $WhatIf) {
        $script:LogFile = Join-Path $script:BackupPath "BackupLog.txt"
        $transcriptPath = Join-Path $script:BackupPath "BackupTranscript.txt"
        Start-Transcript -Path $transcriptPath -Force | Out-Null
    }

    # Get backup items
    $backupItems = Get-BackupItems

    # Show WPF dialog
    Write-LogSection "Backup Selection"

    $dialogResult = Show-WpfBackupDialog -Items $backupItems -BackupPath $script:BackupPath -WhatIf:$WhatIf

    if (-not $dialogResult.Completed -or $dialogResult.Cancelled) {
        Write-Log "Backup cancelled by user" -Level Warning
        exit 0
    }

    # Note: EndTime is now set in AllComplete handler for accurate duration (Issue 1 fix)
    # Metadata and email are also sent in AllComplete handler before panel shows (Issue 2 fix)
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
    if ($PromptForDeletion -and -not $WhatIf -and $script:BackupPath) {
        $deleteResult = [System.Windows.MessageBox]::Show(
            "Backup completed successfully.`n`nDo you want to DELETE the backup folder?`n`n$($script:BackupPath)`n`nThis action cannot be undone!",
            "Delete Backup Folder?",
            [System.Windows.MessageBoxButton]::YesNo,
            [System.Windows.MessageBoxImage]::Warning
        )

        if ($deleteResult -eq [System.Windows.MessageBoxResult]::Yes) {
            Write-Log "User confirmed deletion of backup folder" -Level Warning
            try {
                Get-ChildItem -Path $script:BackupPath -Recurse -Force -ErrorAction SilentlyContinue |
                    ForEach-Object {
                        if ($_.Attributes -band [System.IO.FileAttributes]::ReadOnly) {
                            $_.Attributes = $_.Attributes -bxor [System.IO.FileAttributes]::ReadOnly
                        }
                    }

                Remove-Item -Path $script:BackupPath -Recurse -Force -ErrorAction Stop
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
    Write-Output "[ERROR] Backup failed: $_"
    Write-Output "Status: FAILED"

    [System.Windows.MessageBox]::Show(
        "Backup failed with error:`n`n$_`n`nSee log for details.",
        "FAK Backup Error",
        [System.Windows.MessageBoxButton]::OK,
        [System.Windows.MessageBoxImage]::Error
    ) | Out-Null

    exit 1
}

#endregion
