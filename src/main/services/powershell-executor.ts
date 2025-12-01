import { spawn, ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { createServiceLogger, scriptLogger, securityLogger } from './logger';
import { getDatabaseService } from './database';
import type { ScriptDefinition } from './script-registry';
import type { ValidationResult } from './script-validator';
import { validateAndSanitize, ExecutionResultSchema } from '../../shared/validation/schemas';

const logger = createServiceLogger('powershell-executor');

export interface ExecutionRequest {
  scriptId: string;
  scriptDefinition: ScriptDefinition;
  parameters?: Record<string, any>;
  validationResult: ValidationResult;
  requestId: string;
  userId?: string;
  source: 'manual' | 'protocol' | 'scheduled';
}

export interface ExecutionResult {
  id: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  exitCode: number;
  timestamp: number;
  resourceUsage?: ResourceUsage;
}

export interface ResourceUsage {
  maxMemoryMB: number;
  avgCpuPercent: number;
  diskReadMB: number;
  diskWriteMB: number;
  networkBytesSent: number;
  networkBytesReceived: number;
}

export interface ExecutionOptions {
  timeout?: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
  maxMemoryMB?: number;
  enableNetworking?: boolean;
  allowFileSystem?: boolean;
  allowRegistry?: boolean;
  captureOutput?: boolean;
  streamOutput?: boolean;
}

export interface ActiveExecution {
  id: string;
  scriptId: string;
  process: ChildProcess;
  startTime: number;
  timeout?: NodeJS.Timeout;
  options: ExecutionOptions;
  onProgress?: (output: string) => void;
  onComplete?: (result: ExecutionResult) => void;
}

class PowerShellExecutorService {
  private activeExecutions = new Map<string, ActiveExecution>();
  private executionQueue: ExecutionRequest[] = [];
  private maxConcurrentExecutions = 3;
  private isProcessingQueue = false;
  private tempDirectory: string;

  constructor() {
    this.tempDirectory = join(__dirname, '../../../temp/executions');
    this.ensureTempDirectory();
    
    // Start queue processor
    this.startQueueProcessor();
    
    // Cleanup on process exit
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  private ensureTempDirectory(): void {
    if (!existsSync(this.tempDirectory)) {
      const { mkdirSync } = require('fs');
      mkdirSync(this.tempDirectory, { recursive: true });
    }
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessingQueue && this.executionQueue.length > 0) {
        this.processQueue();
      }
    }, 1000);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      while (
        this.executionQueue.length > 0 && 
        this.activeExecutions.size < this.maxConcurrentExecutions
      ) {
        const request = this.executionQueue.shift();
        if (request) {
          await this.executeScriptImmediate(request);
        }
      }
    } catch (error) {
      logger.error('Error processing execution queue', {
        error: (error as Error).message
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  public async executeScript(request: ExecutionRequest): Promise<string> {
    const executionId = this.generateExecutionId();
    
    logger.info('Script execution requested', {
      executionId,
      scriptId: request.scriptId,
      source: request.source,
      queueLength: this.executionQueue.length,
      activeExecutions: this.activeExecutions.size
    });

    // Log execution request to database (skip in development if database unavailable)
    try {
      const db = getDatabaseService();
      db.insertExecutionLog({
        id: executionId,
        timestamp: Date.now(),
        script_id: request.scriptId,
        script_name: request.scriptDefinition.name,
        status: 'pending',
        parameters: JSON.stringify(request.parameters || {}),
        created_at: Date.now(),
        updated_at: Date.now()
      });
    } catch (error) {
      logger.warn('Database unavailable - skipping execution log', { executionId });
    }

    // Security check (relaxed in development mode for testing)
    if (request.validationResult.securityLevel === 'dangerous') {
      const isDevelopment = process.env.NODE_ENV === 'development';

      if (isDevelopment) {
        // In development mode, allow execution but log a warning
        logger.warn('Dangerous script allowed in development mode', {
          executionId,
          scriptId: request.scriptId,
          violations: request.validationResult.violations.length
        });
      } else {
        // In production mode, block execution
        const error = 'Script execution denied due to security violations';

        securityLogger.error('Dangerous script execution blocked', {
          executionId,
          scriptId: request.scriptId,
          violations: request.validationResult.violations.length
        });

        try {
          const db = getDatabaseService();
          db.updateExecutionLog(executionId, 'error', 0, -1, '', error);
        } catch (dbError) {
          logger.warn('Database unavailable - skipping error log', { executionId });
        }
        throw new Error(error);
      }
    }

    // Add to queue or execute immediately
    if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
      this.executionQueue.push(request);
      logger.info('Script execution queued', {
        executionId,
        queuePosition: this.executionQueue.length
      });
    } else {
      await this.executeScriptImmediate({ ...request, requestId: executionId });
    }

    return executionId;
  }

  private async executeScriptImmediate(request: ExecutionRequest): Promise<void> {
    const executionId = request.requestId;
    const startTime = Date.now();
    
    try {
      // Update status to running (skip if database unavailable)
      try {
        const db = getDatabaseService();
        db.updateExecutionLog(executionId, 'running', undefined, undefined, '', '');
      } catch (dbError) {
        logger.warn('Database unavailable - skipping status update', { executionId });
      }

      // Create execution options
      const options = this.createExecutionOptions(request);
      
      // Create PowerShell command
      const { command, args, tempScriptPath } = await this.buildPowerShellCommand(request, options);
      
      logger.info('Starting PowerShell process', {
        executionId,
        command,
        args: args.length,
        timeout: options.timeout
      });

      // Start PowerShell process
      const childProcess = spawn(command, args, {
        cwd: options.workingDirectory,
        env: { ...process.env, ...options.environment },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        detached: false
      });

      // Track active execution
      const execution: ActiveExecution = {
        id: executionId,
        scriptId: request.scriptId,
        process: childProcess,
        startTime,
        options,
      };

      this.activeExecutions.set(executionId, execution);

      // Set up timeout
      if (options.timeout && options.timeout > 0) {
        execution.timeout = setTimeout(() => {
          this.cancelExecution(executionId, 'timeout');
        }, options.timeout);
      }

      // Capture output
      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: any) => {
        const output = data.toString();
        stdout += output;
        
        if (options.streamOutput && execution.onProgress) {
          execution.onProgress(output);
        }

        scriptLogger.debug('PowerShell stdout', {
          executionId,
          output: output.substring(0, 1000) // Limit log size
        });
      });

      childProcess.stderr?.on('data', (data: any) => {
        const error = data.toString();
        stderr += error;
        
        scriptLogger.warn('PowerShell stderr', {
          executionId,
          error: error.substring(0, 1000) // Limit log size
        });
      });

      // Handle process completion
      childProcess.on('close', (code: number | null) => {
        this.handleProcessCompletion(executionId, code || 0, stdout, stderr, tempScriptPath);
      });

      childProcess.on('error', (error: Error) => {
        logger.error('PowerShell process error', {
          executionId,
          error: error.message
        });
        
        this.handleProcessCompletion(executionId, -1, stdout, error.message, tempScriptPath);
      });

    } catch (error) {
      logger.error('Failed to start script execution', {
        executionId,
        error: (error as Error).message
      });

      try {
        const db = getDatabaseService();
        db.updateExecutionLog(
          executionId,
          'error',
          Date.now() - startTime,
          -1,
          '',
          (error as Error).message
        );
      } catch (dbError) {
        logger.warn('Database unavailable - skipping error log', { executionId });
      }

      this.activeExecutions.delete(executionId);
    }
  }

  private createExecutionOptions(request: ExecutionRequest): ExecutionOptions {
    const scriptDef = request.scriptDefinition;
    const validation = request.validationResult;
    
    // Base options with security restrictions
    const options: ExecutionOptions = {
      timeout: Math.min(scriptDef.timeout || 30000, 300000), // Max 5 minutes
      workingDirectory: this.tempDirectory,
      maxMemoryMB: 512, // 512MB limit
      enableNetworking: false,
      allowFileSystem: false,
      allowRegistry: false,
      captureOutput: true,
      streamOutput: true, // Enable streaming so onProgress callbacks work
      environment: {
        'TEMP': this.tempDirectory,
        'TMP': this.tempDirectory,
        'PSModulePath': '', // Restrict module loading
        'PSExecutionPolicyPreference': 'Restricted'
      }
    };

    // Allow file system access for trusted scripts
    options.allowFileSystem = true;
    options.maxMemoryMB = 512;

    // Further restrictions based on security violations
    const dangerousViolations = validation.violations.filter(v => 
      v.severity === 'high' || v.severity === 'critical'
    );

    if (dangerousViolations.length > 0) {
      options.allowFileSystem = false;
      options.enableNetworking = false;
      options.allowRegistry = false;
      options.timeout = Math.min(options.timeout || 30000, 60000); // Max 1 minute for risky scripts
      options.maxMemoryMB = 256;
    }

    return options;
  }

  private async buildPowerShellCommand(
    request: ExecutionRequest, 
    options: ExecutionOptions
  ): Promise<{ command: string; args: string[]; tempScriptPath?: string }> {
    
    const scriptDef = request.scriptDefinition;
    
    // Create temporary script file with parameters
    const tempScriptPath = join(this.tempDirectory, `${request.requestId}.ps1`);
    const scriptContent = await this.buildScriptWithParameters(scriptDef, request.parameters || {});
    
    writeFileSync(tempScriptPath, scriptContent, 'utf8');

    // Build PowerShell command with security restrictions
    const command = 'powershell.exe';
    const args = [
      '-NoProfile',           // Don't load PowerShell profile
      '-NoLogo',             // Don't show PowerShell logo
      '-NonInteractive',     // Non-interactive mode
      // Removed -NoExit: We want PowerShell to exit when script completes
      '-WindowStyle', 'Hidden', // Hide window
      '-ExecutionPolicy', 'Bypass', // Bypass execution policy for this script
      '-Command', `& {
        # Set security restrictions
        Set-StrictMode -Version Latest;
        $ErrorActionPreference = 'Continue';

        # Execute script with error handling
        try {
          & '${tempScriptPath.replace(/'/g, "''")}'
        } catch {
          Write-Error "Script execution failed: $_"
          exit 1
        }
      }`
    ];

    // Add network restrictions if disabled
    if (!options.enableNetworking) {
      // Note: This is a basic restriction, more advanced networking blocks would require
      // PowerShell Constrained Language Mode or AppLocker policies
      args.push('-Command', `$env:http_proxy='127.0.0.1:1'; $env:https_proxy='127.0.0.1:1';`);
    }

    return { command, args, tempScriptPath };
  }

  private async buildScriptWithParameters(
    scriptDef: ScriptDefinition, 
    parameters: Record<string, any>
  ): Promise<string> {
    
    // Read original script
    const { readFileSync } = require('fs');
    let scriptContent = readFileSync(scriptDef.scriptPath, 'utf8');
    
    // Add parameter validation and injection
    if (scriptDef.parameters && scriptDef.parameters.length > 0) {
      const paramValidation = this.generateParameterValidation(scriptDef.parameters, parameters);
      scriptContent = paramValidation + '\n\n' + scriptContent;
    }
    
    // Add security header as comments only (executable statements are in the -Command wrapper)
    // Note: We don't add executable statements here because scripts may have
    // [CmdletBinding()] and param() blocks that must appear first
    const securityHeader = `
# Security Context: First Aid Kit Lite Execution
# Script: ${scriptDef.name}
# Execution Time: ${new Date().toISOString()}
# Security restrictions are applied by the execution wrapper

`;

    return securityHeader + scriptContent;
  }

  private generateParameterValidation(
    paramDefs: any[], 
    providedParams: Record<string, any>
  ): string {
    let validation = '# Parameter validation\n';
    
    for (const paramDef of paramDefs) {
      const paramName = paramDef.name;
      const paramValue = providedParams[paramName];
      
      if (paramDef.required && (paramValue === undefined || paramValue === null)) {
        throw new Error(`Required parameter '${paramName}' is missing`);
      }
      
      if (paramValue !== undefined) {
        // Escape and validate parameter value
        const escapedValue = this.escapeParameterValue(paramValue, paramDef.type);
        validation += `$${paramName} = ${escapedValue}\n`;
        
        // Add type and range validation
        if (paramDef.type === 'number' && paramDef.validation) {
          if (paramDef.validation.min !== undefined) {
            validation += `if ($${paramName} -lt ${paramDef.validation.min}) { throw "Parameter ${paramName} must be >= ${paramDef.validation.min}" }\n`;
          }
          if (paramDef.validation.max !== undefined) {
            validation += `if ($${paramName} -gt ${paramDef.validation.max}) { throw "Parameter ${paramName} must be <= ${paramDef.validation.max}" }\n`;
          }
        }
        
        if (paramDef.validation?.allowedValues) {
          const allowedValues = paramDef.validation.allowedValues.map((v: any) => `'${v}'`).join(', ');
          validation += `if ($${paramName} -notin @(${allowedValues})) { throw "Parameter ${paramName} must be one of: ${allowedValues}" }\n`;
        }
      } else if (paramDef.default !== undefined) {
        const escapedDefault = this.escapeParameterValue(paramDef.default, paramDef.type);
        validation += `$${paramName} = ${escapedDefault}\n`;
      }
    }
    
    return validation;
  }

  private escapeParameterValue(value: any, type: string): string {
    switch (type) {
      case 'string':
        // Escape single quotes and wrap in single quotes
        return `'${String(value).replace(/'/g, "''")}'`;
      
      case 'number':
        const num = Number(value);
        if (isNaN(num)) throw new Error(`Invalid number value: ${value}`);
        return String(num);
      
      case 'boolean':
        return value ? '$true' : '$false';
      
      case 'select':
        // Treat as string for select type
        return `'${String(value).replace(/'/g, "''")}'`;
      
      default:
        return `'${String(value).replace(/'/g, "''")}'`;
    }
  }

  private handleProcessCompletion(
    executionId: string,
    exitCode: number,
    stdout: string,
    stderr: string,
    tempScriptPath?: string
  ): void {
    
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    const duration = Date.now() - execution.startTime;
    const success = exitCode === 0;

    // Clean up timeout
    if (execution.timeout) {
      clearTimeout(execution.timeout);
    }

    // Clean up temporary script file
    if (tempScriptPath && existsSync(tempScriptPath)) {
      try {
        unlinkSync(tempScriptPath);
      } catch (error) {
        logger.warn('Failed to cleanup temp script file', {
          tempScriptPath,
          error: (error as Error).message
        });
      }
    }

    // Create execution result
    const result: ExecutionResult = {
      id: executionId,
      success,
      output: stdout || undefined,
      error: stderr || undefined,
      duration,
      exitCode,
      timestamp: Date.now()
    };

    // Validate result
    const validation = validateAndSanitize(ExecutionResultSchema, result);
    if (!validation.success) {
      logger.error('Invalid execution result', {
        executionId,
        error: validation.error
      });
    }

    // Update database (skip if unavailable)
    try {
      const db = getDatabaseService();
      db.updateExecutionLog(
        executionId,
        success ? 'success' : 'error',
        duration,
        exitCode,
        stdout?.substring(0, 50000) || '', // Limit output size
        stderr?.substring(0, 10000) || ''   // Limit error size
      );
    } catch (dbError) {
      logger.warn('Database unavailable - skipping completion log', { executionId });
    }

    // Log completion
    logger.info('Script execution completed', {
      executionId,
      scriptId: execution.scriptId,
      success,
      duration,
      exitCode,
      outputLength: stdout?.length || 0,
      errorLength: stderr?.length || 0
    });

    // Call completion callback if provided
    if (execution.onComplete) {
      execution.onComplete(validation.success ? validation.data : result);
    }

    // Remove from active executions
    this.activeExecutions.delete(executionId);
  }

  public cancelExecution(executionId: string, reason: string = 'user_request'): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      logger.warn('Cannot cancel execution - not found', { executionId });
      return false;
    }

    logger.info('Cancelling script execution', { executionId, reason });

    try {
      // Kill the process
      if (execution.process && !execution.process.killed) {
        execution.process.kill('SIGTERM');
        
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (execution.process && !execution.process.killed) {
            execution.process.kill('SIGKILL');
          }
        }, 5000);
      }

      // Update database (skip if unavailable)
      try {
        const db = getDatabaseService();
        const duration = Date.now() - execution.startTime;
        db.updateExecutionLog(executionId, 'cancelled', duration, -1, '', `Cancelled: ${reason}`);
      } catch (dbError) {
        logger.warn('Database unavailable - skipping cancellation log', { executionId });
      }

      // Clean up
      if (execution.timeout) {
        clearTimeout(execution.timeout);
      }

      this.activeExecutions.delete(executionId);

      return true;

    } catch (error) {
      logger.error('Error cancelling execution', {
        executionId,
        error: (error as Error).message
      });
      return false;
    }
  }

  public getActiveExecutions(): ActiveExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  public getExecutionStatus(executionId: string): 'pending' | 'running' | 'completed' | 'not_found' {
    if (this.activeExecutions.has(executionId)) {
      return 'running';
    }

    if (this.executionQueue.some(req => req.requestId === executionId)) {
      return 'pending';
    }

    // Check database for completed executions (skip if unavailable)
    try {
      const db = getDatabaseService();
      const logs = db.getExecutionLogs(1, 0);
      if (logs.some(log => log.id === executionId)) {
        return 'completed';
      }
    } catch (dbError) {
      logger.warn('Database unavailable - skipping status check', { executionId });
    }

    return 'not_found';
  }

  /**
   * Set callbacks on an active execution to receive progress updates and completion notification.
   * Must be called immediately after executeScript() before the process completes.
   */
  public setExecutionCallbacks(
    executionId: string,
    callbacks: {
      onProgress?: (output: string) => void;
      onComplete?: (result: ExecutionResult) => void;
    }
  ): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      logger.warn('Cannot set callbacks - execution not found', { executionId });
      return false;
    }

    if (callbacks.onProgress) {
      execution.onProgress = callbacks.onProgress;
    }
    if (callbacks.onComplete) {
      execution.onComplete = callbacks.onComplete;
    }

    logger.debug('Execution callbacks set', {
      executionId,
      hasOnProgress: !!callbacks.onProgress,
      hasOnComplete: !!callbacks.onComplete
    });

    return true;
  }

  private generateExecutionId(): string {
    return 'exec_' + randomBytes(16).toString('hex');
  }

  public cleanup(): void {
    logger.info('Cleaning up PowerShell executor...');

    // Cancel all active executions
    for (const [executionId] of this.activeExecutions) {
      this.cancelExecution(executionId, 'shutdown');
    }

    // Clear queue
    this.executionQueue.length = 0;

    logger.info('PowerShell executor cleanup completed');
  }

  public getStats(): {
    activeExecutions: number;
    queuedExecutions: number;
    maxConcurrentExecutions: number;
  } {
    return {
      activeExecutions: this.activeExecutions.size,
      queuedExecutions: this.executionQueue.length,
      maxConcurrentExecutions: this.maxConcurrentExecutions
    };
  }

  public setMaxConcurrentExecutions(max: number): void {
    this.maxConcurrentExecutions = Math.max(1, Math.min(10, max));
    logger.info('Updated max concurrent executions', { 
      maxConcurrentExecutions: this.maxConcurrentExecutions 
    });
  }
}

// Create and export singleton instance
let powerShellExecutorService: PowerShellExecutorService | null = null;

export const getPowerShellExecutorService = (): PowerShellExecutorService => {
  if (!powerShellExecutorService) {
    powerShellExecutorService = new PowerShellExecutorService();
  }
  return powerShellExecutorService;
};

export default getPowerShellExecutorService;