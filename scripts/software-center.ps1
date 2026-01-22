#Requires -Version 5.1
<#
.SYNOPSIS
    Launch Horizon's Software Center.

.DESCRIPTION
    Lauches Horizon's Software Center with a catalog of approved software.

.NOTES
    Name: software-center.ps1
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
# Tries URI first (modern clients), falls back to EXE path
$Paths = @(
  "C:\\Windows\CCM\ClientUX\SCClient.exe",
  "C:\\Windows\CCM\SCClient.exe"
)
$hasCcm = $false
$Errors = @()

Write-Output "=== Launch Software Center ===" 
Write-Output "[INFO] Started at: $(Get-Date -Format 'MM-dd-yyyy hh:mmtt')"
Write-Output ""

# Process ---------------------------------------------------------------------------------------------#
# Basic presence check: CCM client service exists
Write-Output "[INFO] Basic Presence: Check if CCM client service exists"
try {
  $hasCcm = Get-Service -Name CcmExec -ErrorAction SilentlyContinue
  Write-Output "[INFO] CCM Client Service found"
  
}
catch {
  $script:Errors += "[ERROR] CCM Client Service not found"
  Write-Output "[ERROR] CCM Client Service not found"
}

if ($hasCcm) {
  # If service is found, then test it. Most reliable way is to open the URI handler
  Write-Output "[INFO] Attempting to launch CCM Client (Software Center)"
  try {
    Start-Process "softwarecenter:" -ErrorAction Stop
    Write-Output "[INFO] CCM Client (Software Center) started successfully"
  }
  catch {
    $script:Errors += "[ERROR] CCM Client (Software Center) did not launch, trying fallback"
    Write-Output "[INFO] CCM Client (Software Center) did not launch, falling back to a known path..."
    # Fallback to known EXE paths
    $Exe = $Paths | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($exe) {
      try {
        Start-Process $Exe
        Write-Output "[INFO] CCM Client (Software Center) fallback started successfully"
        
      }
      catch {
        $script:Errors += "[ERROR] CCM Client (Software Center) fallback did not launch"
        Write-Output "[ERROR] CCM Client (Software Center) fallback did not launch"
      }
    }
    else {
      $script:Errors += "[ERROR] CCM Client (Software Center) not found at expected paths"
      Write-Output "[ERROR] CCM Client (Software Center) not found at expected paths"
    }
  }
}
else {
  Write-Output "[ERROR] Configuration Manager Client Service (CcmExec) for Software Center was not found. Software Center likely is not installed."
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
  Write-Output "[OK] Software Center launched successfully"
  Write-Output ""
  Write-Output "Completed at: $(Get-Date -Format 'MM-dd-yyyy hh:mm:ss tt')"
  Write-Output "Status: SUCCESS"
  exit 0
}