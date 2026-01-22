#Requires -Version 5.1
<#
.SYNOPSIS
    Launch Service Desk Remote Control.

.DESCRIPTION
    Lauches Beyond Trust client for Service Desk to remotely connect and control this machine.

.NOTES
    Name: remote-control.ps1
    Author: Justin Garcia
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
$Errors = @()

Write-Output "=== Launch Service Desk Control ===" 
Write-Output "[INFO] Started at: $(Get-Date -Format 'MM-dd-yyyy hh:mmtt')"
Write-Output ""

# Process ---------------------------------------------------------------------------------------------#
try {
  Start-Process "http://support.corpads.local" -ErrorAction Stop
  Write-Output "[INFO] Opened Beyond Trust/Bomgar webclient..."

}
catch {
  $script:Errors += "[ERROR] Launch Beyond Trust/Bomgar Web Client process failed`: $($Error[0])"
  Write-Output "[ERROR] Launch Beyond Trust/Bomgar Web Client process failed"
}
# Output ---------------------------------------------------------------------------------------------#
Write-Output ""
Write-Output "=== Summary ==="

if ($Errors.Count -gt 0) {
  Write-Output ""
  Write-Output "Errors encountered: $($Errors.Count)"
  foreach ($err in $Errors) {
    Write-Output "  - $err"
  }
  Write-Output ""
  Write-Output "Completed at: $(Get-Date -Format 'MM-dd-yyyy hh:mm:ss tt')"
  Write-Output "Status: FAILED"
  exit 1
}
else {
  Write-Output "[OK] Service Desk Remote Control launched successfully"
  Write-Output ""
  Write-Output "Completed at: $(Get-Date -Format 'MM-dd-yyyy hh:mm:ss tt')"
  Write-Output "Status: SUCCESS"
  exit 0
}