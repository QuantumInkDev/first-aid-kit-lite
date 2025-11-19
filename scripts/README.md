# PowerShell Scripts Directory

This directory contains maintenance scripts for First Aid Kit Lite.

## Script Structure

Each script consists of two files:

1. **`script-name.ps1`** - The PowerShell script
2. **`script-name.json`** - Metadata file describing the script

## Metadata Format

```json
{
  "id": "unique-script-id",
  "name": "Human Readable Name",
  "description": "Detailed description of what the script does",
  "version": "1.0.0",
  "author": "First Aid Kit Lite",
  "category": "Category Name",
  "riskLevel": "low|medium|high",
  "requiredPermissions": ["Administrator", "Read", "Write"],
  "estimatedDuration": 5000,
  "tags": ["tag1", "tag2"],
  "compatibleOS": ["Windows 10", "Windows 11"],
  "requiresElevation": true|false
}
```

## Available Scripts

1. **clear-temp.ps1** - Clear Temporary Files (Low Risk)
2. **flush-dns.ps1** - Flush DNS Cache (Low Risk)
3. **restart-explorer.ps1** - Restart Windows Explorer (Medium Risk)
4. **clean-prefetch.ps1** - Clean Prefetch Data (Low Risk)
5. **reset-network.ps1** - Reset Network Configuration (High Risk)
6. **optimize-drives.ps1** - Optimize Drives (Low Risk)
7. **clear-event-logs.ps1** - Clear Event Logs (Medium Risk)

## Security Notes

- All scripts are validated before execution
- High-risk scripts require explicit user confirmation
- Scripts run in isolated PowerShell processes
- Execution timeout: 5 minutes (configurable)
- All executions are logged for audit purposes
