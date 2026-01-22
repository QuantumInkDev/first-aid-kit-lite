# =============================================================================
# EXAMPLE: How to use parameters passed from protocol URLs
# =============================================================================
#
# URL Format:
#   fak://run/file-restore?path=C%3A%5CUsers%5CExample%5Cfile.txt&backup=true&version=2
#
# The app automatically injects parameters as PowerShell variables.
# You do NOT need param() blocks - variables are pre-defined for you.
#
# =============================================================================

# -----------------------------------------------------------------------------
# These variables are AUTOMATICALLY INJECTED by the executor based on:
# 1. The URL query parameters (e.g., ?path=value&backup=true)
# 2. The parameter definitions in your script's JSON metadata file
#
# You just use them directly like this:
# -----------------------------------------------------------------------------

Write-Output "=== File Restore Tool ==="
Write-Output "Target Path: $path"
Write-Output "Create Backup: $backup"
Write-Output "Version: $version"

# -----------------------------------------------------------------------------
# Example logic using the parameters
# -----------------------------------------------------------------------------

if (-not $path) {
    Write-Error "No path provided!"
    exit 1
}

if (!(Test-Path $path)) {
    Write-Warning "File not found: $path"
    exit 1
}

if ($backup) {
    Write-Output "Creating backup before restore..."
    $backupPath = "$path.bak"
    Copy-Item -Path $path -Destination $backupPath -Force
    Write-Output "Backup created: $backupPath"
}

Write-Output "Restoring version $version..."
# Your restore logic here...

Write-Output "=== Restore Complete ==="

# =============================================================================
# JSON METADATA FILE (save as: scripts/file-restore.json)
# =============================================================================
<#
{
  "id": "file-restore",
  "name": "Restore File",
  "description": "Restores a file from backup location",
  "category": "Recovery",
  "estimatedDuration": 15000,
  "parameters": [
    {
      "name": "path",
      "type": "string",
      "required": true,
      "description": "Full path to the file to restore"
    },
    {
      "name": "backup",
      "type": "boolean",
      "required": false,
      "description": "Create backup before restore",
      "default": false
    },
    {
      "name": "version",
      "type": "number",
      "required": false,
      "description": "Backup version number to restore",
      "default": 1
    }
  ]
}
#>

# =============================================================================
# PARAMETER TYPES SUPPORTED
# =============================================================================
<#
| Type    | URL Example          | PowerShell Variable |
|---------|----------------------|---------------------|
| string  | ?name=John%20Doe     | $name = 'John Doe'  |
| number  | ?count=42            | $count = 42         |
| boolean | ?enabled=true        | $enabled = $true    |
| select  | ?mode=fast           | $mode = 'fast'      |

URL ENCODING REFERENCE:
  Space      ->  %20
  Backslash  ->  %5C
  Colon      ->  %3A
  Ampersand  ->  %26
  Equals     ->  %3D

Example path: C:\Users\John\file.txt
URL encoded:  C%3A%5CUsers%5CJohn%5Cfile.txt
#>
