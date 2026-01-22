#Requires -Version 5.1
<#
.SYNOPSIS
    Get LAN Account Information.

.DESCRIPTION
    Gets information about your Horizon LAN account, displays it in a popup and then asks if you want to reset it. If yes, takes to you the Horizon Password Manager site.

.NOTES
    Name: account-info.ps1
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
# Load WPF MessageBox
Add-Type -AssemblyName PresentationFramework

Write-Output "=== Getting Your Account Information ===" 
Write-Output "[INFO] Started at: $(Get-Date -Format 'MM-dd-yyyy hh:mmtt')"
Write-Output ""

# Functions -------------------------------------------------------------------------------------------#
function Convert-LargeIntegerToDateTime {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][object]$Value)
  if (-not $Value) { return $null }
  try {
    $hi = $Value.HighPart
    $lo = $Value.LowPart
    $fileTime = ([int64]$hi -shl 32) -bor ([uint32]$lo)
    if ($fileTime -le 0) { return $null }
    return [DateTime]::FromFileTimeUtc($fileTime).ToLocalTime()
  }
  catch { return $null }
}

function Convert-LargeIntegerIntervalToTimeSpan {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][object]$Value)
  try {
    $hi = $Value.HighPart
    $lo = $Value.LowPart
    $ticks = ([int64]$hi -shl 32) -bor ([uint32]$lo)
    if ($ticks -ge 0) { return $null } # maxPwdAge is negative
    $ticks = -1 * $ticks
    return [TimeSpan]::FromTicks($ticks)
  }
  catch { return $null }
}

function Get-DomainMaxPwdAge {
  try {
    $root = [ADSI]"LDAP://rootDSE"
    $dn = $root.defaultNamingContext
    $dom = [ADSI]"LDAP://$dn"
    $max = $dom.maxPwdAge
    if (-not $max) { return $null }
    return Convert-LargeIntegerIntervalToTimeSpan -Value $max
  }
  catch { return $null }
}

# ---------- Main AD Info ----------
function Get-CurrentUserAdInfo {
  $sam = $env:USERNAME

  try {
    Import-Module ActiveDirectory -ErrorAction Stop

    $user = Get-ADUser -Identity $sam -Properties `
      DisplayName, SamAccountName, Mail, PasswordLastSet, LastBadPasswordAttempt, PasswordExpired, PasswordNeverExpires, msDS-UserPasswordExpiryTimeComputed

    # Compute expiry (PSO-aware via msDS-UserPasswordExpiryTimeComputed)
    $expires = $null
    if ($user.PasswordNeverExpires) {
      $expires = $null
    }
    elseif ($user.'msDS-UserPasswordExpiryTimeComputed') {
      $expires = [DateTime]::FromFileTimeUtc($user.'msDS-UserPasswordExpiryTimeComputed').ToLocalTime()
    }
    elseif ($user.PasswordLastSet) {
      $domain = Get-ADDomain
      if ($domain.MaxPasswordAge) { $expires = $user.PasswordLastSet + $domain.MaxPasswordAge }
    }

    $expiredNow = $user.PasswordExpired
    if (-not $expiredNow -and $expires) { $expiredNow = ($expires -lt (Get-Date)) }

    return [pscustomobject]@{
      DisplayName            = $user.DisplayName
      SamAccountName         = $user.SamAccountName
      Mail                   = $user.Mail
      PasswordLastSet        = $user.PasswordLastSet
      LastBadPasswordAttempt = $user.LastBadPasswordAttempt
      PasswordNeverExpires   = [bool]$user.PasswordNeverExpires
      PasswordExpires        = $expires
      PasswordExpired        = [bool]$expiredNow
    }
  }
  catch {
    try {
      $root = [ADSI]"LDAP://rootDSE"
      $base = $root.defaultNamingContext

      $searcher = New-Object System.DirectoryServices.DirectorySearcher
      $searcher.SearchRoot = [ADSI]"LDAP://$base"
      $searcher.Filter = "(&(objectClass=user)(sAMAccountName=$sam))"
      $null = $searcher.PropertiesToLoad.AddRange(@(
          'displayName', 'sAMAccountName', 'mail', 'pwdLastSet', 'badPasswordTime', 'userAccountControl'
        ))

      $res = $searcher.FindOne()
      if (-not $res) { throw "User $sam not found in LDAP." }
      $entry = $res.GetDirectoryEntry()

      $displayName = $entry.Properties['displayName'].Value
      $samAccount = $entry.Properties['sAMAccountName'].Value
      $mail = $entry.Properties['mail'].Value
      $pwdLastSetRaw = $entry.Properties['pwdLastSet'].Value
      $badTimeRaw = $entry.Properties['badPasswordTime'].Value
      $uac = [int]$entry.Properties['userAccountControl'].Value

      $pwdLastSet = if ($pwdLastSetRaw) { Convert-LargeIntegerToDateTime -Value $pwdLastSetRaw } else { $null }
      $lastBad = if ($badTimeRaw) { Convert-LargeIntegerToDateTime -Value $badTimeRaw } else { $null }

      $maxAge = Get-DomainMaxPwdAge
      $neverExpires = ($uac -band 0x10000) -ne 0 # UF_DONT_EXPIRE_PASSWD
      $pwdExpires = $null
      if (-not $neverExpires -and $pwdLastSet -and $maxAge) { $pwdExpires = $pwdLastSet + $maxAge }

      $isExpired = $false
      if (-not $neverExpires -and $pwdExpires) { $isExpired = ($pwdExpires -lt (Get-Date)) }

      return [pscustomobject]@{
        DisplayName            = $displayName
        SamAccountName         = $samAccount
        Mail                   = $mail
        PasswordLastSet        = $pwdLastSet
        LastBadPasswordAttempt = $lastBad
        PasswordNeverExpires   = [bool]$neverExpires
        PasswordExpires        = $pwdExpires
        PasswordExpired        = [bool]$isExpired
      }
    }
    catch { throw "Failed to read user info via ADSI: $($_.Exception.Message)" }
  }
}

# Functions -------------------------------------------------------------------------------------------#
# ---------- Orchestrate + Popup ----------
try {
  $info = Get-CurrentUserAdInfo

  # Requested display format
  $fmt = 'dddd, MM-dd-yyyy hh:mmtt'

  # Password last set
  $pwdLastSetText = if ($info.PasswordLastSet) { $info.PasswordLastSet.ToString($fmt) } else { 'Unknown' }

  # Password expires (AD/PSO-aware → ADSI fallback)
  $expiresSourceDate = $null
  if ($info.PasswordNeverExpires) {
    $pwdExpiresText = 'Never'
  }
  elseif ($info.PasswordExpires) {
    $pwdExpiresText = $info.PasswordExpires.ToString($fmt)
    $expiresSourceDate = $info.PasswordExpires
  }
  else {
    $pwdExpiresText = 'Unknown'
  }

  # Last bad password attempt
  $lastBadText = if ($info.LastBadPasswordAttempt) { $info.LastBadPasswordAttempt.ToString($fmt) } else { 'Never' }

  # Password currently expired
  $expiredText = if ($info.PasswordExpired) { 'Yes' } else { 'No' }

  # Days until expiration (last line)
  $daysLine = 'Days until expiration: Unknown'
  if ($pwdExpiresText -match '(?i)^(never)$') {
    $daysLine = 'Days until expiration: Never'
  }
  elseif ($expiresSourceDate) {
    $daysRemaining = [math]::Ceiling( ($expiresSourceDate - (Get-Date)).TotalDays )
    if ($daysRemaining -lt 0) {
      $daysLine = "Expired {0} days ago" -f ([math]::Abs($daysRemaining))
    }
    else {
      $daysLine = "$daysRemaining days"
    }
  }

  $lines = @(
    "Display Name: $($info.DisplayName)",
    "SAM Account Name: $($info.SamAccountName)",
    "Email: $($info.Mail)",
    "Password last set: $pwdLastSetText",
    "Password expires: $pwdExpiresText",
    "Last bad password attempt: $lastBadText",
    "Password currently expired: $expiredText",
    "Days until expiration: $daysLine"
  )
  $output = [pscustomobject]@{
    "Display Name"               = $($info.DisplayName)
    "SAM Account Name"           = $($info.SamAccountName)
    "Email"                      = $($info.Mail)
    "Password Last Set"          = $pwdLastSetText
    "Password Expires"           = $pwdExpiresText
    "Last Bad Password Attempt"  = $lastBadText
    "Password Currently Expired" = $expiredText
    "Days Until Expiration"      = $daysLine
  }

  $text = ($lines -join "`n") + "`n`nDo you want to reset your password now?"

  $result = [System.Windows.MessageBox]::Show($text, 'Account Information', 'YesNo', 'Information')
  if ($result -eq 'Yes') {
    Start-Process 'https://acmpm/HPM/'
  }
}
catch {
  [System.Windows.MessageBox]::Show("Error: $($_.Exception.Message)", 'Account Information', 'OK', 'Error') | Out-Null
}




# Output ---------------------------------------------------------------------------------------------#
Write-Output ""
Write-Output "=== Summary ==="

Write-Output $output | Format-List

Write-Output ""
Write-Output "Completed at: $(Get-Date -Format 'MM-dd-yyyy hh:mm:ss tt')"
Write-Output "Status: SUCCESS"

exit 0