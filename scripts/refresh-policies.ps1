#Requires -Version 5.1
<#
.SYNOPSIS
    Refresh Machine and GPO poilicies.

.DESCRIPTION
    This script will launch the refresh policies script locally installed on the machine already.

.NOTES
    Name: refresh-policies.ps1
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
$ScriptPath = "C:\\Program Files\\HBCBSNJ\\GPOmapdrives\\MapDrives.cmd"
$Errors = @()

Write-Output "=== Refresh Machine Policies ===" 
Write-Output "[INFO] Started at: $(Get-Date -Format 'MM-dd-yyyy hh:mmtt')"
Write-Output ""

# Process ---------------------------------------------------------------------------------------------#
try {
  # Ensure the script exists, if not update user and exit
  if (Test-Path $ScriptPath) {
    Write-Output "[INFO] Refresh Policy Script found"
  }
}
catch {
  Write-Output "[SKIP] Refresh Policy Script not found, will now exit"
  return
}

Write-Output "[INFO] Starting Policy Refresh..."

try {
  # Invoke Refresh Policy Script
  $Process = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c `"$ScriptPath`"" `
    -WindowStyle Hidden `
    -Wait `
    -PassThru

  $Exit = $Process.ExitCode
}
catch {
  $script:Errors += "[ERROR] Refresh Policy process failed`: $Error[0]"
  Write-Output "[ERROR] Refresh Policy process failed"
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
}

Write-Output ""
Write-Output "Completed at: $(Get-Date -Format 'MM-dd-yyyy hh:mm:ss tt')"

if ($Exit -eq 0) {
  Write-Output "[OK] Refresh Policy process completed successfully"
  Write-Output "Status: SUCCESS"
  exit 0
}
else {
  Write-Output "[ERROR] Refresh Policy process failed with exit code: $Exit"
  Write-Output "Status: FAILED"
  exit 1
}