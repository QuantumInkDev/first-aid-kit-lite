/**
 * System Info Service
 * Gathers system information for the dashboard including AD user data,
 * network info, drive space, BitLocker status, and real-time metrics.
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import * as os from 'os';
import { createServiceLogger } from './logger';

const logger = createServiceLogger('system-info');

// ============================================================================
// Type Definitions
// ============================================================================

export interface DriveSpace {
  drive: string;
  total: number;
  used: number;
  available: number;
  percentUsed: number;
}

export interface UptimeInfo {
  seconds: number;
  bootTime: string;
  formatted: string;
}

export interface UserInfo {
  displayName: string;
  firstName: string;
  employeeId: string;
  samAccountName: string;
  email: string;
  source: 'active-directory' | 'cached' | 'unavailable';
  cachedAt?: number;
  passwordExpiration: {
    expiresAt: string | null;
    daysUntilExpiration: number | null;
    isExpired: boolean;
  } | null;
}

export interface NetworkInfo {
  type: 'Ethernet' | 'WiFi' | 'Unknown' | 'Disconnected';
  ipAddress: string;
  adapterName: string;
}

export interface BitLockerInfo {
  status: 'Encrypted' | 'Decrypted' | 'Encrypting' | 'Decrypting' | 'Unknown' | 'Error';
  protectionStatus: 'On' | 'Off' | 'Unknown';
  encryptionPercentage?: number;
}

export interface DashboardInfo {
  driveSpace: DriveSpace | null;
  uptime: UptimeInfo;
  userInfo: UserInfo;
  lastSeen: string | null;
  assetSerial: string;
  osVersion: string;
  osBuild: string;
  network: NetworkInfo;
  bitLocker: BitLockerInfo;
  timestamp: number;
  refreshedAt: string;
}

export interface RealtimeMetrics {
  ram: {
    total: number;
    used: number;
    free: number;
    percentUsed: number;
  };
  cpu: {
    percentUsed: number;
    cores: number;
    model: string;
    speed: number;
  };
  timestamp: number;
}

interface CacheData {
  adInfo: {
    displayName: string;
    firstName: string;
    employeeId: string;
    email: string;
    samAccountName: string;
    cachedAt: number;
    passwordExpiration?: {
      expiresAt: string | null;
      daysUntilExpiration: number | null;
      isExpired: boolean;
    } | null;
  } | null;
  lastSeen: number | null;
  version: number;
}

// ============================================================================
// System Info Service Class
// ============================================================================

class SystemInfoService {
  private cacheDir: string;
  private cachePath: string;
  private cache: CacheData;
  private lastCpuInfo: { idle: number; total: number } | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.cacheDir = join(userDataPath, 'cache');
    this.cachePath = join(this.cacheDir, 'system-dashboard.json');

    // Ensure cache directory exists
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }

    // Load or initialize cache
    this.cache = this.loadCache();

    // Update last seen on startup
    this.updateLastSeen();

    logger.info('System info service initialized');
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  private loadCache(): CacheData {
    try {
      if (existsSync(this.cachePath)) {
        const data = readFileSync(this.cachePath, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed.version === 1) {
          return parsed;
        }
      }
    } catch (error) {
      logger.warn('Failed to load cache, using defaults', { error });
    }

    return {
      adInfo: null,
      lastSeen: null,
      version: 1,
    };
  }

  private saveCache(): void {
    try {
      writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save cache', { error });
    }
  }

  public updateLastSeen(): void {
    this.cache.lastSeen = Date.now();
    this.saveCache();
  }

  // ==========================================================================
  // Real-time Metrics (Node.js os module - always available)
  // ==========================================================================

  private extractCpuModel(fullModel: string): string {
    // Extract short model like "i7-12700H" from "12th Gen Intel(R) Core(TM) i7-12700H"
    const match = fullModel.match(/i[3579]-\d{4,5}[A-Z]*/i)
      || fullModel.match(/Ryzen \d \d{4}[A-Z]*/i)
      || fullModel.match(/[A-Z]\d{4}[A-Z]*/); // Fallback for other patterns
    return match ? match[0] : fullModel.split('@')[0].trim().slice(-15);
  }

  public getRealtimeMetrics(): RealtimeMetrics {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      ram: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentUsed: Math.round((usedMem / totalMem) * 100),
      },
      cpu: {
        percentUsed: this.getCpuUsage(),
        cores: os.cpus().length,
        model: this.extractCpuModel(os.cpus()[0]?.model || 'Unknown'),
        speed: os.cpus()[0]?.speed || 0,
      },
      timestamp: Date.now(),
    };
  }

  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;

    if (this.lastCpuInfo) {
      const idleDiff = idle - this.lastCpuInfo.idle;
      const totalDiff = total - this.lastCpuInfo.total;
      const usage = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;
      this.lastCpuInfo = { idle, total };
      return Math.max(0, Math.min(100, usage));
    }

    this.lastCpuInfo = { idle, total };
    return 0; // First call returns 0, subsequent calls will have diff
  }

  // ==========================================================================
  // System Uptime (Node.js - always available)
  // ==========================================================================

  private getUptime(): UptimeInfo {
    const uptimeSeconds = os.uptime();
    const bootTime = new Date(Date.now() - uptimeSeconds * 1000);

    return {
      seconds: uptimeSeconds,
      bootTime: bootTime.toISOString(),
      formatted: this.formatUptime(uptimeSeconds),
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join(' ') : '< 1m';
  }

  // ==========================================================================
  // PowerShell Command Execution Helper
  // ==========================================================================

  private runPowerShell(script: string, timeoutMs = 10000): Promise<string> {
    return new Promise((resolve, reject) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', script,
      ], {
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        ps.kill();
        reject(new Error('PowerShell command timed out'));
      }, timeoutMs);

      ps.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ps.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ps.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr || `PowerShell exited with code ${code}`));
        }
      });

      ps.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  // ==========================================================================
  // Drive Space (PowerShell WMI)
  // ==========================================================================

  private async getDriveSpace(): Promise<DriveSpace | null> {
    try {
      const script = `
        $disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object Size, FreeSpace
        if ($disk) {
          @{
            Size = $disk.Size
            FreeSpace = $disk.FreeSpace
          } | ConvertTo-Json
        }
      `;

      const result = await this.runPowerShell(script);
      const data = JSON.parse(result);

      const total = Number(data.Size);
      const available = Number(data.FreeSpace);
      const used = total - available;

      return {
        drive: 'C:',
        total,
        used,
        available,
        percentUsed: Math.round((used / total) * 100),
      };
    } catch (error) {
      logger.warn('Failed to get drive space', { error });
      return null;
    }
  }

  // ==========================================================================
  // Network Info (PowerShell)
  // ==========================================================================

  private async getNetworkInfo(): Promise<NetworkInfo> {
    try {
      const script = `
        $adapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1
        if ($adapter) {
          $ip = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1
          $type = switch -Regex ($adapter.InterfaceDescription) {
            'Wi-Fi|Wireless|802\.11' { 'WiFi' }
            'Ethernet|LAN|Realtek|Intel.*Ethernet' { 'Ethernet' }
            default { 'Unknown' }
          }
          @{
            Type = $type
            IPAddress = if ($ip) { $ip.IPAddress } else { 'Unknown' }
            AdapterName = $adapter.Name
          } | ConvertTo-Json
        } else {
          @{
            Type = 'Disconnected'
            IPAddress = 'N/A'
            AdapterName = 'None'
          } | ConvertTo-Json
        }
      `;

      const result = await this.runPowerShell(script);
      const data = JSON.parse(result);

      return {
        type: data.Type as NetworkInfo['type'],
        ipAddress: data.IPAddress,
        adapterName: data.AdapterName,
      };
    } catch (error) {
      logger.warn('Failed to get network info', { error });
      return {
        type: 'Unknown',
        ipAddress: 'Unavailable',
        adapterName: 'Unknown',
      };
    }
  }

  // ==========================================================================
  // OS Version (PowerShell WMI)
  // ==========================================================================

  private async getOsInfo(): Promise<{ osVersion: string; osBuild: string }> {
    try {
      const script = `
        $os = Get-CimInstance Win32_OperatingSystem
        $caption = $os.Caption -replace 'Microsoft ', ''
        $build = $os.BuildNumber
        $displayVersion = (Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion' -ErrorAction SilentlyContinue).DisplayVersion
        if (-not $displayVersion) { $displayVersion = '' }
        @{
          Caption = $caption
          Build = $build
          DisplayVersion = $displayVersion
        } | ConvertTo-Json -Compress
      `;

      const result = await this.runPowerShell(script);
      const parsed = JSON.parse(result.trim());
      const osVersion = parsed.Caption || 'Unknown';
      const buildParts = [];
      if (parsed.DisplayVersion) buildParts.push(parsed.DisplayVersion);
      if (parsed.Build) buildParts.push(`Build ${parsed.Build}`);
      const osBuild = buildParts.join(', ') || 'Unknown';

      return { osVersion, osBuild };
    } catch (error) {
      logger.warn('Failed to get OS info', { error });
      return { osVersion: 'Unknown', osBuild: 'Unknown' };
    }
  }

  // ==========================================================================
  // BitLocker Status (PowerShell)
  // ==========================================================================

  private async getBitLockerInfo(): Promise<BitLockerInfo> {
    try {
      // Use manage-bde which works for standard users (read-only)
      const script = `
        $output = manage-bde -status C: 2>&1
        $outputStr = $output -join [Environment]::NewLine

        $status = 'Unknown'
        $protection = 'Unknown'
        $percentage = 0

        if ($outputStr -match 'Fully Encrypted') {
          $status = 'FullyEncrypted'
        } elseif ($outputStr -match 'Fully Decrypted') {
          $status = 'FullyDecrypted'
        } elseif ($outputStr -match 'Encryption in Progress') {
          $status = 'EncryptionInProgress'
        } elseif ($outputStr -match 'Decryption in Progress') {
          $status = 'DecryptionInProgress'
        } elseif ($outputStr -match 'BitLocker Drive Encryption') {
          $status = 'Unknown'
        }

        if ($outputStr -match 'Protection Status:\\s*(Protection On|On)') {
          $protection = 'On'
        } elseif ($outputStr -match 'Protection Status:\\s*(Protection Off|Off)') {
          $protection = 'Off'
        }

        if ($outputStr -match 'Percentage Encrypted:\\s*(\\d+)') {
          $percentage = [int]$Matches[1]
        }

        @{
          VolumeStatus = $status
          ProtectionStatus = $protection
          EncryptionPercentage = $percentage
        } | ConvertTo-Json
      `;

      const result = await this.runPowerShell(script);
      const data = JSON.parse(result);

      // Map VolumeStatus to our status enum
      let status: BitLockerInfo['status'] = 'Unknown';
      switch (data.VolumeStatus) {
        case 'FullyEncrypted':
          status = 'Encrypted';
          break;
        case 'FullyDecrypted':
          status = 'Decrypted';
          break;
        case 'EncryptionInProgress':
          status = 'Encrypting';
          break;
        case 'DecryptionInProgress':
          status = 'Decrypting';
          break;
      }

      return {
        status,
        protectionStatus: data.ProtectionStatus === 'On' ? 'On' : data.ProtectionStatus === 'Off' ? 'Off' : 'Unknown',
        encryptionPercentage: data.EncryptionPercentage,
      };
    } catch (error) {
      logger.warn('Failed to get BitLocker info', { error });
      return {
        status: 'Unknown',
        protectionStatus: 'Unknown',
      };
    }
  }

  // ==========================================================================
  // AD User Info (PowerShell ADSI - follows account-info.ps1 pattern)
  // ==========================================================================

  private async getAdUserInfo(): Promise<UserInfo> {
    try {
      // Use ADSI for resilience (doesn't require AD PowerShell module)
      const script = `
        $sam = $env:USERNAME
        try {
          $root = [ADSI]"LDAP://rootDSE"
          $base = $root.defaultNamingContext

          $searcher = New-Object System.DirectoryServices.DirectorySearcher
          $searcher.SearchRoot = [ADSI]"LDAP://$base"
          $searcher.Filter = "(&(objectClass=user)(sAMAccountName=$sam))"
          $null = $searcher.PropertiesToLoad.AddRange(@('displayName', 'givenName', 'sAMAccountName', 'mail', 'ipPhone', 'msDS-UserPasswordExpiryTimeComputed'))

          $res = $searcher.FindOne()
          if ($res) {
            $entry = $res.GetDirectoryEntry()
            
            # Get password expiration
            $pwdExpiry = $null
            $fileTime = $res.Properties['msDS-UserPasswordExpiryTimeComputed']
            if ($fileTime -and $fileTime.Count -gt 0 -and $fileTime[0] -gt 0 -and $fileTime[0] -lt [Int64]::MaxValue) {
              try {
                $pwdExpiry = [datetime]::FromFileTime($fileTime[0]).ToString('o')
              } catch {
                $pwdExpiry = $null
              }
            }
            
            @{
              DisplayName = [string]$entry.Properties['displayName'].Value
              FirstName = [string]$entry.Properties['givenName'].Value
              SamAccountName = [string]$entry.Properties['sAMAccountName'].Value
              Email = [string]$entry.Properties['mail'].Value
              EmployeeId = [string]$entry.Properties['ipPhone'].Value
              PasswordExpiry = $pwdExpiry
              Source = 'active-directory'
            } | ConvertTo-Json
          } else {
            throw "User not found"
          }
        } catch {
          @{
            DisplayName = ''
            FirstName = ''
            SamAccountName = $sam
            Email = ''
            EmployeeId = ''
            PasswordExpiry = $null
            Source = 'unavailable'
            Error = $_.Exception.Message
          } | ConvertTo-Json
        }
      `;

      const result = await this.runPowerShell(script, 15000); // 15 second timeout for AD
      const data = JSON.parse(result);

      // Calculate password expiration info
      const calculatePasswordExpiration = (expiryIso: string | null): UserInfo['passwordExpiration'] => {
        if (!expiryIso) return null;
        try {
          const expiresAt = new Date(expiryIso);
          const now = new Date();
          const diffMs = expiresAt.getTime() - now.getTime();
          const daysUntilExpiration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          return {
            expiresAt: expiryIso,
            daysUntilExpiration,
            isExpired: daysUntilExpiration < 0,
          };
        } catch {
          return null;
        }
      };

      if (data.Source === 'active-directory' && data.DisplayName) {
        const passwordExpiration = calculatePasswordExpiration(data.PasswordExpiry);
        
        // Cache the AD info
        this.cache.adInfo = {
          displayName: data.DisplayName,
          firstName: data.FirstName || '',
          employeeId: data.EmployeeId || '',
          email: data.Email || '',
          samAccountName: data.SamAccountName,
          cachedAt: Date.now(),
          passwordExpiration,
        };
        this.saveCache();

        // Prefer first word of displayName over givenName for greeting
        // (displayName reflects chosen/preferred name, givenName is legal name)
        const preferredFirstName = data.DisplayName
          ? data.DisplayName.split(' ')[0]
          : (data.FirstName || '');

        return {
          displayName: data.DisplayName,
          firstName: preferredFirstName,
          employeeId: data.EmployeeId || 'N/A',
          samAccountName: data.SamAccountName,
          email: data.Email || '',
          source: 'active-directory',
          passwordExpiration,
        };
      }

      // AD unavailable - try cache
      if (this.cache.adInfo) {
        // Prefer first word of displayName over cached firstName
        const preferredFirstName = this.cache.adInfo.displayName
          ? this.cache.adInfo.displayName.split(' ')[0]
          : (this.cache.adInfo.firstName || '');

        return {
          displayName: this.cache.adInfo.displayName,
          firstName: preferredFirstName,
          employeeId: this.cache.adInfo.employeeId || 'N/A',
          samAccountName: this.cache.adInfo.samAccountName,
          email: this.cache.adInfo.email,
          source: 'cached',
          cachedAt: this.cache.adInfo.cachedAt,
          passwordExpiration: this.cache.adInfo.passwordExpiration || null,
        };
      }

      // No cache, return unavailable
      const username = os.userInfo().username;
      return {
        displayName: username,
        firstName: username,
        employeeId: 'Unavailable',
        samAccountName: username,
        email: '',
        source: 'unavailable',
        passwordExpiration: null,
      };
    } catch (error) {
      logger.warn('Failed to get AD user info', { error });

      // Fallback to cache
      if (this.cache.adInfo) {
        // Prefer first word of displayName over cached firstName
        const preferredFirstName = this.cache.adInfo.displayName
          ? this.cache.adInfo.displayName.split(' ')[0]
          : (this.cache.adInfo.firstName || '');

        return {
          displayName: this.cache.adInfo.displayName,
          firstName: preferredFirstName,
          employeeId: this.cache.adInfo.employeeId || 'N/A',
          samAccountName: this.cache.adInfo.samAccountName,
          email: this.cache.adInfo.email,
          source: 'cached',
          cachedAt: this.cache.adInfo.cachedAt,
          passwordExpiration: this.cache.adInfo.passwordExpiration || null,
        };
      }

      const username = os.userInfo().username;
      return {
        displayName: username,
        firstName: username,
        employeeId: 'Unavailable',
        samAccountName: username,
        email: '',
        source: 'unavailable',
        passwordExpiration: null,
      };
    }
  }

  // ==========================================================================
  // Main Dashboard Info Getter
  // ==========================================================================

  public async getDashboardInfo(): Promise<DashboardInfo> {
    logger.debug('Fetching dashboard info');

    // Run PowerShell queries in parallel for performance
    const [driveSpace, network, bitLocker, userInfo, osInfo] = await Promise.all([
      this.getDriveSpace(),
      this.getNetworkInfo(),
      this.getBitLockerInfo(),
      this.getAdUserInfo(),
      this.getOsInfo(),
    ]);

    const now = new Date();

    return {
      driveSpace,
      uptime: this.getUptime(),
      userInfo,
      lastSeen: this.cache.lastSeen ? new Date(this.cache.lastSeen).toISOString() : null,
      assetSerial: os.hostname(),
      osVersion: osInfo.osVersion,
      osBuild: osInfo.osBuild,
      network,
      bitLocker,
      timestamp: Date.now(),
      refreshedAt: now.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let systemInfoService: SystemInfoService | null = null;

export function getSystemInfoService(): SystemInfoService {
  if (!systemInfoService) {
    systemInfoService = new SystemInfoService();
  }
  return systemInfoService;
}

export function initializeSystemInfoService(): void {
  getSystemInfoService();
}
