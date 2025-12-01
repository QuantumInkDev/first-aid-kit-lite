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
  "estimatedDuration": 5000,
  "tags": ["tag1", "tag2"],
  "compatibleOS": ["Windows 10", "Windows 11"]
}
```

## Available Scripts

1. **clear-temp.ps1** - Clear Temporary Files
2. **flush-dns.ps1** - Flush DNS Cache
3. **restart-explorer.ps1** - Restart Windows Explorer
4. **clean-prefetch.ps1** - Clean Prefetch Data
5. **reset-network.ps1** - Reset Network Configuration
6. **optimize-drives.ps1** - Optimize Drives
7. **clear-event-logs.ps1** - Clear Event Logs

## Security Notes

- All scripts are validated before execution
- Scripts run in isolated PowerShell processes
- Execution timeout: 5 minutes (configurable)
- All executions are logged for audit purposes
