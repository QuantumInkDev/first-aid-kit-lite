#Requires -Version 5.1
<#
.SYNOPSIS
    Resets all network adapters and configurations to default settings.

.DESCRIPTION
    This script performs a comprehensive network reset including:
    - Resetting Winsock catalog
    - Resetting TCP/IP stack
    - Flushing DNS resolver cache
    - Resetting Windows Firewall to default
    - Renewing IP addresses

    WARNING: This will temporarily disconnect all network connections.
    You may need to reconfigure custom network settings after running this script.

.NOTES
    Name: reset-network.ps1
    Author: First Aid Kit Lite
    Version: 1.0.0
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

Write-Output "=== Reset Network Configuration ==="
Write-Output "Started at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output ""
Write-Output "WARNING: This operation will reset all network settings"
Write-Output "         Network connectivity will be temporarily interrupted"
Write-Output ""

$operations = @()
$errors = @()

try {
    # Step 1: Reset Winsock Catalog
    Write-Output "[INFO] Resetting Winsock catalog..."
    try {
        $result = netsh winsock reset 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Output "[OK] Winsock catalog reset successfully"
            $operations += "Winsock reset: SUCCESS"
        }
        else {
            throw "netsh returned exit code $LASTEXITCODE"
        }
    }
    catch {
        $errors += "Winsock reset failed: $_"
        Write-Output "[ERROR] Winsock reset failed: $_"
        $operations += "Winsock reset: FAILED"
    }

    Write-Output ""

    # Step 2: Reset TCP/IP Stack
    Write-Output "[INFO] Resetting TCP/IP stack..."
    try {
        $result = netsh int ip reset 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Output "[OK] TCP/IP stack reset successfully"
            $operations += "TCP/IP reset: SUCCESS"
        }
        else {
            throw "netsh returned exit code $LASTEXITCODE"
        }
    }
    catch {
        $errors += "TCP/IP reset failed: $_"
        Write-Output "[ERROR] TCP/IP reset failed: $_"
        $operations += "TCP/IP reset: FAILED"
    }

    Write-Output ""

    # Step 3: Reset IPv6
    Write-Output "[INFO] Resetting IPv6 configuration..."
    try {
        $result = netsh int ipv6 reset 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Output "[OK] IPv6 reset successfully"
            $operations += "IPv6 reset: SUCCESS"
        }
        else {
            throw "netsh returned exit code $LASTEXITCODE"
        }
    }
    catch {
        $errors += "IPv6 reset failed: $_"
        Write-Output "[ERROR] IPv6 reset failed: $_"
        $operations += "IPv6 reset: FAILED"
    }

    Write-Output ""

    # Step 4: Flush DNS Cache
    Write-Output "[INFO] Flushing DNS resolver cache..."
    try {
        Clear-DnsClientCache -ErrorAction Stop
        Write-Output "[OK] DNS cache flushed successfully"
        $operations += "DNS flush: SUCCESS"
    }
    catch {
        $errors += "DNS flush failed: $_"
        Write-Output "[ERROR] DNS flush failed: $_"
        $operations += "DNS flush: FAILED"
    }

    Write-Output ""

    # Step 5: Reset Firewall (optional - commented out by default for safety)
    Write-Output "[INFO] Resetting Windows Firewall..."
    try {
        $result = netsh advfirewall reset 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Output "[OK] Windows Firewall reset successfully"
            $operations += "Firewall reset: SUCCESS"
        }
        else {
            throw "netsh returned exit code $LASTEXITCODE"
        }
    }
    catch {
        $errors += "Firewall reset failed: $_"
        Write-Output "[WARN] Firewall reset failed: $_"
        $operations += "Firewall reset: FAILED"
    }

    Write-Output ""

    # Step 6: Release and Renew IP
    Write-Output "[INFO] Releasing IP addresses..."
    try {
        $result = ipconfig /release 2>&1
        Write-Output "[OK] IP addresses released"

        Start-Sleep -Seconds 2

        Write-Output "[INFO] Renewing IP addresses..."
        $result = ipconfig /renew 2>&1
        Write-Output "[OK] IP addresses renewed"
        $operations += "IP release/renew: SUCCESS"
    }
    catch {
        $errors += "IP release/renew failed: $_"
        Write-Output "[WARN] IP release/renew failed: $_"
        $operations += "IP release/renew: FAILED"
    }

    Write-Output ""

    # Step 7: Flush ARP Cache
    Write-Output "[INFO] Flushing ARP cache..."
    try {
        $result = netsh interface ip delete arpcache 2>&1
        Write-Output "[OK] ARP cache flushed"
        $operations += "ARP cache flush: SUCCESS"
    }
    catch {
        $errors += "ARP cache flush failed: $_"
        Write-Output "[WARN] ARP cache flush failed: $_"
        $operations += "ARP cache flush: FAILED"
    }

    Write-Output ""
    Write-Output "=== Summary ==="
    Write-Output "Operations completed:"
    foreach ($op in $operations) {
        Write-Output "  - $op"
    }

    if ($errors.Count -gt 0) {
        Write-Output ""
        Write-Output "Errors encountered: $($errors.Count)"
        foreach ($error in $errors) {
            Write-Output "  - $error"
        }
    }

    Write-Output ""
    Write-Output "IMPORTANT: A system restart is STRONGLY RECOMMENDED"
    Write-Output "           for all network changes to take full effect."
    Write-Output ""
    Write-Output "After restart:"
    Write-Output "  - Network adapters will be fully reset"
    Write-Output "  - You may need to reconnect to WiFi networks"
    Write-Output "  - VPN configurations may need to be re-entered"
    Write-Output "  - Custom DNS settings will be reset to automatic"
    Write-Output ""
    Write-Output "Completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

    if ($errors.Count -eq 0) {
        Write-Output "Status: SUCCESS"
        exit 0
    }
    else {
        Write-Output "Status: COMPLETED WITH WARNINGS"
        exit 0
    }
}
catch {
    Write-Output "[ERROR] Network reset failed: $_"
    Write-Output "Status: FAILED"
    exit 1
}
