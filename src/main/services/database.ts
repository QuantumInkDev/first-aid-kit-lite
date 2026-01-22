// NOTE: better-sqlite3 is loaded lazily to prevent native module crashes
// when the binary is not compiled for the correct Electron version
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createServiceLogger } from './logger';

const logger = createServiceLogger('database');

// Dynamic import type for better-sqlite3
type Database = import('better-sqlite3').Database;
type DatabaseStatement = import('better-sqlite3').Statement<any[]>;

export interface ExecutionLogRecord {
  id: string;
  timestamp: number;
  script_id: string;
  script_name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  duration?: number;
  exit_code?: number;
  output?: string;
  error?: string;
  parameters?: string; // JSON string
  created_at: number;
  updated_at: number;
}

export interface SettingRecord {
  key: string;
  value: string; // JSON string
  created_at: number;
  updated_at: number;
}

export interface AuditLogRecord {
  id: string;
  timestamp: number;
  event_type: string;
  user_action: string;
  resource: string;
  details?: string; // JSON string
  ip_address?: string;
  user_agent?: string;
  risk_level: 'low' | 'medium' | 'high';
  created_at: number;
}

class DatabaseService {
  private db: Database | null = null;
  private initialized = false;
  private initError: string | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbDir = join(userDataPath, 'database');

    // Ensure database directory exists
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = join(dbDir, 'fakl.db');

    try {
      // Lazy-load better-sqlite3 to prevent crashes if native module is incompatible
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const BetterSqlite3 = require('better-sqlite3');

      this.db = new BetterSqlite3(dbPath, {
        verbose: (message?: unknown, ...additionalArgs: unknown[]) =>
          logger.debug('SQLite:', String(message), ...additionalArgs),
      }) as Database;

      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');

      // Set reasonable timeouts
      this.db.pragma('busy_timeout = 10000');

      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');

      logger.info('Database connection established', { path: dbPath });

      this.initializeSchema();
      this.initializePreparedStatements();
      this.initialized = true;

    } catch (error) {
      const errorMsg = (error as Error).message;
      this.initError = errorMsg;
      logger.error('Failed to initialize database', {
        error: errorMsg,
        path: dbPath
      });
      // Don't throw - allow app to run without database
      logger.warn('Application will run without database functionality');
    }
  }

  private initializeSchema(): void {
    if (!this.db) return;
    logger.info('Initializing database schema...');

    // Create execution_logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS execution_logs (
        id TEXT PRIMARY KEY NOT NULL,
        timestamp INTEGER NOT NULL,
        script_id TEXT NOT NULL,
        script_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'success', 'error', 'cancelled')),
        duration INTEGER,
        exit_code INTEGER,
        output TEXT,
        error TEXT,
        parameters TEXT, -- JSON string
        created_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
      )
    `);

    // Create settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL, -- JSON string
        created_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
      )
    `);

    // Create audit_logs table for security events
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY NOT NULL,
        timestamp INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        user_action TEXT NOT NULL,
        resource TEXT NOT NULL,
        details TEXT, -- JSON string
        ip_address TEXT,
        user_agent TEXT,
        risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'medium', 'high')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON execution_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_execution_logs_script_id ON execution_logs(script_id);
      CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON execution_logs(status);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON audit_logs(risk_level);
    `);

    // Create triggers to automatically update the updated_at timestamp
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_execution_logs_timestamp 
      AFTER UPDATE ON execution_logs
      FOR EACH ROW
      BEGIN
        UPDATE execution_logs SET updated_at = (unixepoch('subsec') * 1000) WHERE id = NEW.id;
      END;
      
      CREATE TRIGGER IF NOT EXISTS update_settings_timestamp 
      AFTER UPDATE ON settings
      FOR EACH ROW
      BEGIN
        UPDATE settings SET updated_at = (unixepoch('subsec') * 1000) WHERE key = NEW.key;
      END;
    `);

    logger.info('Database schema initialized successfully');
  }

  private initializePreparedStatements(): void {
    if (!this.db) return;
    logger.info('Initializing prepared statements...');

    // Execution logs statements
    this.insertExecutionLogStmt = this.db.prepare(`
      INSERT INTO execution_logs (id, timestamp, script_id, script_name, status, duration, exit_code, output, error, parameters)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.updateExecutionLogStmt = this.db.prepare(`
      UPDATE execution_logs 
      SET status = ?, duration = ?, exit_code = ?, output = ?, error = ?
      WHERE id = ?
    `);

    this.selectExecutionLogsStmt = this.db.prepare(`
      SELECT * FROM execution_logs 
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    // Settings statements
    this.insertOrUpdateSettingStmt = this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `);

    this.selectSettingStmt = this.db.prepare(`
      SELECT value FROM settings WHERE key = ?
    `);

    this.selectAllSettingsStmt = this.db.prepare(`
      SELECT key, value FROM settings
    `);

    // Audit logs statements
    this.insertAuditLogStmt = this.db.prepare(`
      INSERT INTO audit_logs (id, timestamp, event_type, user_action, resource, details, ip_address, user_agent, risk_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.selectAuditLogsStmt = this.db.prepare(`
      SELECT * FROM audit_logs 
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    logger.info('Prepared statements initialized successfully');
  }

  // Prepared statements - initialized after database connection (may be null if db unavailable)
  private insertExecutionLogStmt: DatabaseStatement | null = null;
  private updateExecutionLogStmt: DatabaseStatement | null = null;
  private selectExecutionLogsStmt: DatabaseStatement | null = null;
  private insertOrUpdateSettingStmt: DatabaseStatement | null = null;
  private selectSettingStmt: DatabaseStatement | null = null;
  private selectAllSettingsStmt: DatabaseStatement | null = null;
  private insertAuditLogStmt: DatabaseStatement | null = null;
  private selectAuditLogsStmt: DatabaseStatement | null = null;

  // Execution log methods
  public insertExecutionLog(log: ExecutionLogRecord): void {
    if (!this.initialized || !this.insertExecutionLogStmt) {
      throw new Error('Database not initialized');
    }

    try {
      this.insertExecutionLogStmt.run(
        log.id,
        log.timestamp,
        log.script_id,
        log.script_name,
        log.status,
        log.duration,
        log.exit_code,
        log.output,
        log.error,
        log.parameters
      );

      logger.debug('Execution log inserted', { id: log.id, script_id: log.script_id });
    } catch (error) {
      logger.error('Failed to insert execution log', { 
        error: (error as Error).message,
        log_id: log.id 
      });
      throw error;
    }
  }

  public updateExecutionLog(
    id: string,
    status: ExecutionLogRecord['status'],
    duration?: number,
    exitCode?: number,
    output?: string,
    error?: string
  ): void {
    if (!this.initialized || !this.updateExecutionLogStmt) {
      throw new Error('Database not initialized');
    }

    try {
      const result = this.updateExecutionLogStmt.run(status, duration, exitCode, output, error, id);
      
      if (result.changes === 0) {
        logger.warn('No execution log found to update', { id });
      } else {
        logger.debug('Execution log updated', { id, status });
      }
    } catch (error) {
      logger.error('Failed to update execution log', { 
        error: (error as Error).message,
        log_id: id 
      });
      throw error;
    }
  }

  public getExecutionLogs(limit: number = 100, offset: number = 0): ExecutionLogRecord[] {
    if (!this.initialized || !this.selectExecutionLogsStmt) {
      throw new Error('Database not initialized');
    }

    try {
      const rows = this.selectExecutionLogsStmt.all(limit, offset) as ExecutionLogRecord[];
      logger.debug('Retrieved execution logs', { count: rows.length, limit, offset });
      return rows;
    } catch (error) {
      logger.error('Failed to retrieve execution logs', { error: (error as Error).message });
      throw error;
    }
  }

  // Settings methods
  public setSetting<T>(key: string, value: T): void {
    if (!this.initialized || !this.insertOrUpdateSettingStmt) {
      throw new Error('Database not initialized');
    }

    try {
      const jsonValue = JSON.stringify(value);
      this.insertOrUpdateSettingStmt.run(key, jsonValue);
      
      logger.debug('Setting saved', { key });
    } catch (error) {
      logger.error('Failed to save setting', { 
        error: (error as Error).message,
        key 
      });
      throw error;
    }
  }

  public getSetting<T>(key: string, defaultValue?: T): T | null {
    if (!this.initialized || !this.selectSettingStmt) {
      throw new Error('Database not initialized');
    }

    try {
      const row = this.selectSettingStmt.get(key) as { value: string } | undefined;
      
      if (!row) {
        return defaultValue || null;
      }

      const parsedValue = JSON.parse(row.value) as T;
      logger.debug('Setting retrieved', { key });
      return parsedValue;
    } catch (error) {
      logger.error('Failed to retrieve setting', { 
        error: (error as Error).message,
        key 
      });
      return defaultValue || null;
    }
  }

  public getAllSettings(): Record<string, any> {
    if (!this.initialized || !this.selectAllSettingsStmt) {
      throw new Error('Database not initialized');
    }

    try {
      const rows = this.selectAllSettingsStmt.all() as Array<{ key: string; value: string }>;
      const settings: Record<string, any> = {};

      for (const row of rows) {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch (parseError) {
          logger.warn('Failed to parse setting value', { key: row.key });
          settings[row.key] = row.value;
        }
      }

      logger.debug('Retrieved all settings', { count: rows.length });
      return settings;
    } catch (error) {
      logger.error('Failed to retrieve all settings', { error: (error as Error).message });
      throw error;
    }
  }

  // Audit log methods
  public insertAuditLog(auditLog: AuditLogRecord): void {
    if (!this.initialized || !this.insertAuditLogStmt) {
      throw new Error('Database not initialized');
    }

    try {
      this.insertAuditLogStmt.run(
        auditLog.id,
        auditLog.timestamp,
        auditLog.event_type,
        auditLog.user_action,
        auditLog.resource,
        auditLog.details,
        auditLog.ip_address,
        auditLog.user_agent,
        auditLog.risk_level
      );

      logger.debug('Audit log inserted', { 
        id: auditLog.id, 
        event_type: auditLog.event_type,
        risk_level: auditLog.risk_level 
      });
    } catch (error) {
      logger.error('Failed to insert audit log', { 
        error: (error as Error).message,
        audit_id: auditLog.id 
      });
      throw error;
    }
  }

  public getAuditLogs(limit: number = 100, offset: number = 0): AuditLogRecord[] {
    if (!this.initialized || !this.selectAuditLogsStmt) {
      throw new Error('Database not initialized');
    }

    try {
      const rows = this.selectAuditLogsStmt.all(limit, offset) as AuditLogRecord[];
      logger.debug('Retrieved audit logs', { count: rows.length, limit, offset });
      return rows;
    } catch (error) {
      logger.error('Failed to retrieve audit logs', { error: (error as Error).message });
      throw error;
    }
  }

  // Cleanup methods
  public cleanupOldLogs(retentionDays: number = 30): number {
    if (!this.initialized || !this.db) {
      throw new Error('Database not initialized');
    }

    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    try {
      const result = this.db.prepare(`
        DELETE FROM execution_logs WHERE timestamp < ?
      `).run(cutoffTime);

      logger.info('Cleaned up old execution logs', { 
        deleted_count: result.changes,
        retention_days: retentionDays 
      });

      return result.changes;
    } catch (error) {
      logger.error('Failed to cleanup old logs', { error: (error as Error).message });
      throw error;
    }
  }


  /**
   * Clear all completed execution logs (success, error, cancelled)
   * Running logs are preserved
   */
  public clearCompletedLogs(): number {
    if (!this.initialized || !this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = this.db.prepare(`
        DELETE FROM execution_logs WHERE status IN ('success', 'error', 'cancelled')
      `).run();

      logger.info('Cleared completed execution logs', { 
        deleted_count: result.changes 
      });

      return result.changes;
    } catch (error) {
      logger.error('Failed to clear completed logs', { error: (error as Error).message });
      throw error;
    }
  }

  // Health check
  public healthCheck(): { status: 'healthy' | 'unhealthy'; details: string } {
    if (!this.db) {
      return {
        status: 'unhealthy',
        details: this.initError || 'Database not initialized'
      };
    }

    try {
      // Simple query to test database connection
      const result = this.db.prepare('SELECT 1 as test').get() as { test: number };

      if (result.test === 1) {
        return { status: 'healthy', details: 'Database connection is working' };
      } else {
        return { status: 'unhealthy', details: 'Database query returned unexpected result' };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: `Database error: ${(error as Error).message}`
      };
    }
  }

  // Close database connection
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      logger.info('Database connection closed');
    }
  }

  // Reinitialize database (used after clearing all data)
  public reinitialize(): void {
    const userDataPath = app.getPath('userData');
    const dbDir = join(userDataPath, 'database');

    // Ensure database directory exists
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = join(dbDir, 'fakl.db');

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const BetterSqlite3 = require('better-sqlite3');

      this.db = new BetterSqlite3(dbPath, {
        verbose: (message?: unknown, ...additionalArgs: unknown[]) =>
          logger.debug('SQLite:', String(message), ...additionalArgs),
      }) as Database;

      this.db.pragma('journal_mode = WAL');
      this.db.pragma('busy_timeout = 10000');
      this.db.pragma('foreign_keys = ON');

      this.initializeSchema();
      this.initializePreparedStatements();
      this.initialized = true;
      this.initError = null;
      logger.info('Database reinitialized successfully', { path: dbPath });
    } catch (error) {
      this.initError = (error as Error).message;
      logger.error('Failed to reinitialize database', { error: this.initError });
      throw error;
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

// Create and export singleton instance
let databaseService: DatabaseService | null = null;
let databaseInitFailed = false;

export const getDatabaseService = (): DatabaseService => {
  if (databaseInitFailed) {
    throw new Error('Database service unavailable - native module failed to load');
  }

  if (!databaseService) {
    try {
      databaseService = new DatabaseService();
      // Check if initialization succeeded
      if (!databaseService.isInitialized()) {
        databaseInitFailed = true;
        throw new Error('Database service failed to initialize');
      }
    } catch (error) {
      databaseInitFailed = true;
      throw error;
    }
  }
  return databaseService;
};

// Check if database service is available without throwing
export const isDatabaseAvailable = (): boolean => {
  if (databaseInitFailed) return false;
  if (databaseService) return databaseService.isInitialized();

  // Try to initialize
  try {
    const db = getDatabaseService();
    return db.isInitialized();
  } catch {
    return false;
  }
};

export default getDatabaseService;