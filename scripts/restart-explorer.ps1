#Requires -Version 5.1
<#
.SYNOPSIS
    Restarts the Windows Explorer process.

.DESCRIPTION
    This script safely stops and restarts the Windows Explorer process (explorer.exe).
    This can help resolve issues with the taskbar, Start menu, or file explorer
    not responding properly.

.NOTES
    Name: restart-explorer.ps1
    Author: Justin Garcia
    Version: 1.0.0
#>

[CmdletBinding()]
param()


## House Keeping -------------------------------------------------------------------------------------#
Remove-Variable * -ErrorAction SilentlyContinue; Remove-Module *; $Error.Clear() | Out-Null; Clear-Host

# Error handling -------------------------------------------------------------------------------------#
$ErrorActionPreference = "Stop"

# Process ---------------------------------------------------------------------------------------------#
Write-Output "=== Restart Windows Explorer ==="
Write-Output "[INFO] Started at: $(Get-Date -Format 'MM-dd-yyyy hh:mmtt')"
Write-Output ""

try {
    # Check if Explorer is running
    Write-Output "[INFO] Checking for Windows Explorer process..."
    $explorerProcesses = Get-Process -Name "explorer" -ErrorAction SilentlyContinue

    if ($null -eq $explorerProcesses) {
        Write-Output "[WARN] Windows Explorer is not currently running"
        Write-Output "[INFO] Starting Windows Explorer..."
        Start-Process "explorer.exe"
        Start-Sleep -Seconds 2
        Write-Output "[OK] Windows Explorer started successfully"
    }
    else {
        $processCount = ($explorerProcesses | Measure-Object).Count
        Write-Output "[INFO] Found $processCount Explorer process(es) running"
        Write-Output ""

        # Stop Explorer process
        Write-Output "[INFO] Stopping Windows Explorer..."
        Stop-Process -Name "explorer" -Force -ErrorAction Stop
        Write-Output "[OK] Windows Explorer stopped"

        # Wait for process to fully terminate
        Write-Output "[INFO] Waiting for process to terminate..."
        Start-Sleep -Seconds 2

        # Verify Explorer has stopped
        $stillRunning = Get-Process -Name "explorer" -ErrorAction SilentlyContinue
        if ($null -ne $stillRunning) {
            Write-Output "[WARN] Explorer process still detected, forcing termination..."
            Stop-Process -Name "explorer" -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }

        # Start Explorer again
        Write-Output "[INFO] Starting Windows Explorer..."
        Start-Process "explorer.exe"

        # Wait for Explorer to start
        Start-Sleep -Seconds 2

        # Verify Explorer started
        $newExplorer = Get-Process -Name "explorer" -ErrorAction SilentlyContinue
        if ($null -eq $newExplorer) {
            throw "Failed to restart Windows Explorer - process did not start"
        }

        Write-Output "[OK] Windows Explorer restarted successfully"
    }

    Write-Output ""
    Write-Output "=== Summary ==="
    Write-Output "Operation: Windows Explorer restart"
    Write-Output "Status: Completed successfully"
    Write-Output "Current Explorer PID: $((Get-Process -Name 'explorer').Id)"
    Write-Output ""
    Write-Output "Completed at: $(Get-Date -Format 'MM-dd-yyyy hh:mm:ss tt')"
    Write-Output "Status: SUCCESS"

    exit 0
}
catch {
    Write-Output "[ERROR] Failed to restart Windows Explorer: $_"
    Write-Output ""
    Write-Output "=== Recovery Attempt ==="
    try {
        Write-Output "[INFO] Attempting to start Explorer manually..."
        Start-Process "explorer.exe" -ErrorAction Stop
        Start-Sleep -Seconds 2
        Write-Output "[OK] Explorer started in recovery mode"
        Write-Output "Status: SUCCESS (with recovery)"
        exit 0
    }
    catch {
        Write-Output "[ERROR] Recovery failed: $_"
        Write-Output "Status: FAILED"
        Write-Output ""
        Write-Output "MANUAL RECOVERY NEEDED:"
        Write-Output "1. Press Ctrl+Shift+Esc to open Task Manager"
        Write-Output "2. Click File > Run new task"
        Write-Output "3. Type 'explorer.exe' and click OK"
        exit 1
    }
}
