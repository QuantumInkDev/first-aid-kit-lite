import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { createServiceLogger, securityLogger } from './logger';
import type { ScriptDefinition } from './script-registry';

const logger = createServiceLogger('script-validator');

export interface ValidationResult {
  isValid: boolean;
  securityLevel: 'safe' | 'caution' | 'dangerous';
  violations: SecurityViolation[];
  warnings: string[];
  hash: string;
  analysis: ScriptAnalysis;
}

export interface SecurityViolation {
  type: 'dangerous_command' | 'network_access' | 'file_system_write' | 'registry_access' | 
        'process_execution' | 'elevated_privileges' | 'external_download' | 'suspicious_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  lineNumber?: number;
  snippet?: string;
  recommendation?: string;
}

export interface ScriptAnalysis {
  commands: string[];
  imports: string[];
  functions: string[];
  variables: string[];
  fileOperations: FileOperation[];
  networkOperations: NetworkOperation[];
  processOperations: ProcessOperation[];
  registryOperations: RegistryOperation[];
  complexity: 'low' | 'medium' | 'high';
  linesOfCode: number;
}

export interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'create' | 'modify';
  path?: string;
  lineNumber: number;
  command: string;
}

export interface NetworkOperation {
  type: 'http' | 'https' | 'ftp' | 'smtp' | 'tcp' | 'udp';
  destination?: string;
  lineNumber: number;
  command: string;
}

export interface ProcessOperation {
  type: 'start' | 'stop' | 'kill' | 'invoke';
  process?: string;
  lineNumber: number;
  command: string;
}

export interface RegistryOperation {
  type: 'read' | 'write' | 'delete' | 'create';
  key?: string;
  lineNumber: number;
  command: string;
}

class ScriptValidatorService {
  // Dangerous PowerShell commands that require careful review
  private static readonly DANGEROUS_COMMANDS = [
    // Process and execution
    'invoke-expression', 'iex', 'invoke-command', 'icm', 'start-process',
    'invoke-item', 'ii', 'invoke-wmimethod', 'invoke-cimmethod',
    
    // Network and downloads
    'invoke-webrequest', 'iwr', 'invoke-restmethod', 'irm', 'wget', 'curl',
    'new-object.*net.webclient', 'downloadfile', 'downloadstring',
    
    // File system operations
    'remove-item', 'ri', 'del', 'rmdir', 'copy-item', 'ci', 'move-item', 'mi',
    'new-item', 'ni', 'set-content', 'sc', 'add-content', 'ac',
    
    // Registry operations
    'new-itemproperty', 'set-itemproperty', 'remove-itemproperty',
    'remove-item.*hklm', 'remove-item.*hkcu',
    
    // Service and scheduled task operations
    'new-service', 'set-service', 'start-service', 'stop-service', 'remove-service',
    'new-scheduledtask', 'register-scheduledtask', 'unregister-scheduledtask',
    
    // Security and credentials
    'convertto-securestring', 'convertfrom-securestring', 'get-credential',
    'set-executionpolicy', 'bypass', 'unrestricted',
    
    // System modification
    'add-type', 'reflection.assembly', 'system.runtime.interopservices',
    'kernel32', 'user32', 'advapi32', 'ntdll'
  ];

  // Suspicious patterns that might indicate malicious behavior
  private static readonly SUSPICIOUS_PATTERNS = [
    // Obfuscation
    /\[char\]\d+/gi,                    // Character encoding obfuscation
    /-join\s*\(.*\|.*%/gi,              // String joining obfuscation  
    /\$\w+\s*=\s*\$\w+\[\d+,\d+\]/gi,   // Array slicing obfuscation
    /-replace\s+['"]\w['"]/gi,          // Character replacement
    
    // Base64 encoding
    /[a-zA-Z0-9+\/]{20,}={0,2}/g,       // Base64 strings
    /frombase64string/gi,               // Base64 decoding
    
    // Reverse shells and backdoors
    /\$client\s*=.*tcpclient/gi,        // TCP client creation
    /getstream\(\)/gi,                  // Network streams
    /\$stream.*networkstream/gi,        // Network stream usage
    
    // Credential harvesting
    /mimikatz/gi,                       // Mimikatz tool
    /lsass/gi,                          // LSASS process
    /sam\s*file/gi,                     // SAM file access
    
    // Anti-analysis
    /sleep\s+\d+/gi,                    // Sleep commands
    /start-sleep/gi,                    // PowerShell sleep
    /timeout/gi,                        // Timeout commands
    
    // Persistence mechanisms
    /startup|autostart/gi,              // Startup persistence
    /currentversion\\run/gi,            // Registry run keys
    /scheduled.*task/gi,                // Scheduled tasks
  ];

  // File paths that should trigger warnings
  private static readonly SENSITIVE_PATHS = [
    'windows/system32', 'program files', 'users/', 'documents and settings',
    'temp/', 'appdata/', 'startup/', 'desktop/', 'downloads/'
  ];

  public static async validateScript(scriptDef: ScriptDefinition): Promise<ValidationResult> {
    try {
      logger.debug('Starting script validation', { 
        scriptId: scriptDef.id,
        scriptPath: scriptDef.scriptPath 
      });

      // Read script content
      const content = readFileSync(scriptDef.scriptPath, 'utf8');
      
      // Generate hash for integrity checking
      const hash = createHash('sha256').update(content).digest('hex');
      
      // Perform analysis
      const analysis = this.analyzeScript(content);
      const violations = this.checkSecurityViolations(content, analysis);
      const warnings = this.generateWarnings(analysis);
      
      // Determine security level
      const securityLevel = this.calculateSecurityLevel(violations);
      const isValid = securityLevel !== 'dangerous';

      const result: ValidationResult = {
        isValid,
        securityLevel,
        violations,
        warnings,
        hash,
        analysis
      };

      // Log security findings
      if (violations.length > 0 || warnings.length > 0) {
        securityLogger.warn('Script validation completed with findings', {
          scriptId: scriptDef.id,
          scriptPath: scriptDef.scriptPath,
          securityLevel,
          violationCount: violations.length,
          warningCount: warnings.length,
          highSeverityViolations: violations.filter(v => v.severity === 'high' || v.severity === 'critical').length
        });
      } else {
        logger.info('Script validation completed successfully', {
          scriptId: scriptDef.id,
          securityLevel
        });
      }

      return result;

    } catch (error) {
      logger.error('Script validation failed', {
        scriptId: scriptDef.id,
        scriptPath: scriptDef.scriptPath,
        error: (error as Error).message
      });

      // Return dangerous result on validation failure
      return {
        isValid: false,
        securityLevel: 'dangerous',
        violations: [{
          type: 'suspicious_pattern',
          severity: 'critical',
          description: `Validation failed: ${(error as Error).message}`,
          recommendation: 'Script cannot be validated and should not be executed'
        }],
        warnings: ['Script validation failed'],
        hash: '',
        analysis: {
          commands: [],
          imports: [],
          functions: [],
          variables: [],
          fileOperations: [],
          networkOperations: [],
          processOperations: [],
          registryOperations: [],
          complexity: 'high',
          linesOfCode: 0
        }
      };
    }
  }

  private static analyzeScript(content: string): ScriptAnalysis {
    const lines = content.split('\n');
    const analysis: ScriptAnalysis = {
      commands: [],
      imports: [],
      functions: [],
      variables: [],
      fileOperations: [],
      networkOperations: [],
      processOperations: [],
      registryOperations: [],
      complexity: 'low',
      linesOfCode: lines.filter(line => line.trim() && !line.trim().startsWith('#')).length
    };

    let complexity = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      const lineNumber = i + 1;
      
      if (!line || line.startsWith('#')) continue;

      // Extract commands
      const commandMatch = line.match(/^(\w+[-\w]*)/);
      if (commandMatch && !analysis.commands.includes(commandMatch[1])) {
        analysis.commands.push(commandMatch[1]);
      }

      // Extract imports/modules
      if (line.includes('import-module') || line.includes('using')) {
        const importMatch = line.match(/import-module\s+(\w+)|using\s+(\w+)/);
        if (importMatch) {
          const moduleName = importMatch[1] || importMatch[2];
          if (!analysis.imports.includes(moduleName)) {
            analysis.imports.push(moduleName);
          }
        }
      }

      // Extract functions
      if (line.includes('function ')) {
        const funcMatch = line.match(/function\s+([\w-]+)/);
        if (funcMatch && !analysis.functions.includes(funcMatch[1])) {
          analysis.functions.push(funcMatch[1]);
        }
      }

      // Extract variables
      const varMatches = line.match(/\$(\w+)/g);
      if (varMatches) {
        for (const varMatch of varMatches) {
          const varName = varMatch.substring(1);
          if (!analysis.variables.includes(varName)) {
            analysis.variables.push(varName);
          }
        }
      }

      // Analyze file operations
      this.analyzeFileOperations(line, lineNumber, analysis);
      
      // Analyze network operations
      this.analyzeNetworkOperations(line, lineNumber, analysis);
      
      // Analyze process operations
      this.analyzeProcessOperations(line, lineNumber, analysis);
      
      // Analyze registry operations
      this.analyzeRegistryOperations(line, lineNumber, analysis);

      // Calculate complexity factors
      if (line.includes('if ') || line.includes('else') || line.includes('elseif')) complexity++;
      if (line.includes('for ') || line.includes('while ') || line.includes('do ')) complexity++;
      if (line.includes('try ') || line.includes('catch ') || line.includes('finally')) complexity++;
      if (line.includes('switch ') || line.includes('case ')) complexity++;
    }

    // Determine complexity level
    if (complexity > 20 || analysis.linesOfCode > 500) {
      analysis.complexity = 'high';
    } else if (complexity > 10 || analysis.linesOfCode > 100) {
      analysis.complexity = 'medium';
    }

    return analysis;
  }

  private static analyzeFileOperations(line: string, lineNumber: number, analysis: ScriptAnalysis): void {
    const originalLine = line;
    
    if (line.includes('remove-item') || line.includes('del ') || line.includes('rmdir')) {
      analysis.fileOperations.push({
        type: 'delete',
        path: this.extractPathFromLine(originalLine),
        lineNumber,
        command: originalLine
      });
    }
    
    if (line.includes('copy-item') || line.includes('copy ') || line.includes('cp ')) {
      analysis.fileOperations.push({
        type: 'create',
        path: this.extractPathFromLine(originalLine),
        lineNumber,
        command: originalLine
      });
    }
    
    if (line.includes('move-item') || line.includes('move ') || line.includes('mv ')) {
      analysis.fileOperations.push({
        type: 'modify',
        path: this.extractPathFromLine(originalLine),
        lineNumber,
        command: originalLine
      });
    }
    
    if (line.includes('set-content') || line.includes('add-content') || line.includes('out-file')) {
      analysis.fileOperations.push({
        type: 'write',
        path: this.extractPathFromLine(originalLine),
        lineNumber,
        command: originalLine
      });
    }
    
    if (line.includes('get-content') || line.includes('get-item') || line.includes('test-path')) {
      analysis.fileOperations.push({
        type: 'read',
        path: this.extractPathFromLine(originalLine),
        lineNumber,
        command: originalLine
      });
    }
  }

  private static analyzeNetworkOperations(line: string, lineNumber: number, analysis: ScriptAnalysis): void {
    const originalLine = line;
    
    if (line.includes('invoke-webrequest') || line.includes('invoke-restmethod') || line.includes('wget') || line.includes('curl')) {
      const urlMatch = originalLine.match(/(https?:\/\/[^\s'"]+)/i);
      analysis.networkOperations.push({
        type: line.includes('https') ? 'https' : 'http',
        destination: urlMatch ? urlMatch[1] : undefined,
        lineNumber,
        command: originalLine
      });
    }
    
    if (line.includes('new-object') && line.includes('net.webclient')) {
      analysis.networkOperations.push({
        type: 'http',
        lineNumber,
        command: originalLine
      });
    }
    
    if (line.includes('tcpclient') || line.includes('udpclient')) {
      analysis.networkOperations.push({
        type: line.includes('tcp') ? 'tcp' : 'udp',
        lineNumber,
        command: originalLine
      });
    }
  }

  private static analyzeProcessOperations(line: string, lineNumber: number, analysis: ScriptAnalysis): void {
    const originalLine = line;
    
    if (line.includes('start-process') || line.includes('invoke-item')) {
      const processMatch = originalLine.match(/start-process\s+['""]?([^'""'\s]+)|invoke-item\s+['""]?([^'""'\s]+)/i);
      analysis.processOperations.push({
        type: 'start',
        process: processMatch ? (processMatch[1] || processMatch[2]) : undefined,
        lineNumber,
        command: originalLine
      });
    }
    
    if (line.includes('stop-process') || line.includes('kill ')) {
      analysis.processOperations.push({
        type: 'stop',
        lineNumber,
        command: originalLine
      });
    }
    
    if (line.includes('invoke-expression') || line.includes('invoke-command')) {
      analysis.processOperations.push({
        type: 'invoke',
        lineNumber,
        command: originalLine
      });
    }
  }

  private static analyzeRegistryOperations(line: string, lineNumber: number, analysis: ScriptAnalysis): void {
    const originalLine = line;
    
    if (line.includes('new-itemproperty') || line.includes('set-itemproperty')) {
      const keyMatch = originalLine.match(/(hklm:|hkcu:)([^'""\s]+)/i);
      analysis.registryOperations.push({
        type: line.includes('new-') ? 'create' : 'write',
        key: keyMatch ? keyMatch[0] : undefined,
        lineNumber,
        command: originalLine
      });
    }
    
    if (line.includes('remove-itemproperty') || (line.includes('remove-item') && (line.includes('hklm:') || line.includes('hkcu:')))) {
      const keyMatch = originalLine.match(/(hklm:|hkcu:)([^'""\s]+)/i);
      analysis.registryOperations.push({
        type: 'delete',
        key: keyMatch ? keyMatch[0] : undefined,
        lineNumber,
        command: originalLine
      });
    }
    
    if (line.includes('get-itemproperty') || line.includes('get-item') && (line.includes('hklm:') || line.includes('hkcu:'))) {
      const keyMatch = originalLine.match(/(hklm:|hkcu:)([^'""\s]+)/i);
      analysis.registryOperations.push({
        type: 'read',
        key: keyMatch ? keyMatch[0] : undefined,
        lineNumber,
        command: originalLine
      });
    }
  }

  private static extractPathFromLine(line: string): string | undefined {
    // Try to extract file paths from the command
    const pathMatches = [
      /['"""]([^'"""]+\.[a-zA-Z]{1,4})['"""]/,  // Quoted paths with extensions
      /['"""]([c-z]:\\[^'"""]+)['"""]/i,        // Quoted Windows paths
      /\s([c-z]:\\[\w\\.\\-]+)/i,               // Unquoted Windows paths
      /\s([\/\w\.\-\\]+\.[a-zA-Z]{1,4})/,       // Unix-style paths
    ];

    for (const regex of pathMatches) {
      const match = line.match(regex);
      if (match) return match[1];
    }

    return undefined;
  }

  private static checkSecurityViolations(content: string, analysis: ScriptAnalysis): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    const lines = content.split('\n');

    // Check for dangerous commands
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      const lineNumber = i + 1;
      
      for (const dangerousCmd of this.DANGEROUS_COMMANDS) {
        if (line.includes(dangerousCmd)) {
          violations.push({
            type: 'dangerous_command',
            severity: this.getDangerousCommandSeverity(dangerousCmd),
            description: `Use of potentially dangerous command: ${dangerousCmd}`,
            lineNumber,
            snippet: lines[i].trim(),
            recommendation: `Review the necessity of using '${dangerousCmd}' and ensure it's used safely`
          });
        }
      }
    }

    // Check for suspicious patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      let match;
      const contentLines = content.split('\n');
      
      for (let i = 0; i < contentLines.length; i++) {
        pattern.lastIndex = 0; // Reset regex
        if ((match = pattern.exec(contentLines[i]))) {
          violations.push({
            type: 'suspicious_pattern',
            severity: 'high',
            description: `Suspicious pattern detected: ${match[0]}`,
            lineNumber: i + 1,
            snippet: contentLines[i].trim(),
            recommendation: 'Review this pattern as it may indicate obfuscation or malicious behavior'
          });
        }
      }
    }

    // Check file operations for sensitive paths
    for (const fileOp of analysis.fileOperations) {
      if (fileOp.path && this.isSensitivePath(fileOp.path)) {
        violations.push({
          type: 'file_system_write',
          severity: fileOp.type === 'delete' ? 'high' : 'medium',
          description: `${fileOp.type} operation on sensitive path: ${fileOp.path}`,
          lineNumber: fileOp.lineNumber,
          snippet: fileOp.command,
          recommendation: 'Ensure file operations on sensitive paths are necessary and safe'
        });
      }
    }

    // Check network operations
    if (analysis.networkOperations.length > 0) {
      for (const netOp of analysis.networkOperations) {
        violations.push({
          type: 'network_access',
          severity: 'medium',
          description: `Network operation detected: ${netOp.type}${netOp.destination ? ` to ${netOp.destination}` : ''}`,
          lineNumber: netOp.lineNumber,
          snippet: netOp.command,
          recommendation: 'Ensure network access is necessary and destination is trusted'
        });
      }
    }

    // Check registry operations
    for (const regOp of analysis.registryOperations) {
      if (regOp.type === 'write' || regOp.type === 'create' || regOp.type === 'delete') {
        violations.push({
          type: 'registry_access',
          severity: 'medium',
          description: `Registry ${regOp.type} operation${regOp.key ? ` on ${regOp.key}` : ''}`,
          lineNumber: regOp.lineNumber,
          snippet: regOp.command,
          recommendation: 'Registry modifications should be carefully reviewed for system impact'
        });
      }
    }

    // Check process operations
    for (const procOp of analysis.processOperations) {
      if (procOp.type === 'start' || procOp.type === 'invoke') {
        violations.push({
          type: 'process_execution',
          severity: 'medium',
          description: `Process ${procOp.type} operation${procOp.process ? ` for ${procOp.process}` : ''}`,
          lineNumber: procOp.lineNumber,
          snippet: procOp.command,
          recommendation: 'Process execution should be limited to trusted applications'
        });
      }
    }

    return violations;
  }

  private static getDangerousCommandSeverity(command: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCommands = ['invoke-expression', 'iex', 'downloadstring', 'bypass', 'unrestricted'];
    const highCommands = ['invoke-webrequest', 'start-process', 'remove-item', 'set-executionpolicy'];
    const mediumCommands = ['copy-item', 'move-item', 'new-item'];

    if (criticalCommands.some(cmd => command.includes(cmd))) return 'critical';
    if (highCommands.some(cmd => command.includes(cmd))) return 'high';
    if (mediumCommands.some(cmd => command.includes(cmd))) return 'medium';
    
    return 'low';
  }

  private static isSensitivePath(path: string): boolean {
    const lowerPath = path.toLowerCase();
    return this.SENSITIVE_PATHS.some(sensitivePath => 
      lowerPath.includes(sensitivePath.toLowerCase())
    );
  }

  private static generateWarnings(analysis: ScriptAnalysis): string[] {
    const warnings: string[] = [];

    if (analysis.complexity === 'high') {
      warnings.push('Script has high complexity - thorough testing recommended');
    }

    if (analysis.linesOfCode > 500) {
      warnings.push('Script is very long - consider breaking into smaller modules');
    }

    if (analysis.functions.length === 0 && analysis.linesOfCode > 50) {
      warnings.push('Script lacks function structure - consider refactoring for maintainability');
    }

    if (analysis.networkOperations.length > 3) {
      warnings.push('Script performs multiple network operations - verify all destinations are trusted');
    }

    if (analysis.fileOperations.filter(op => op.type === 'delete').length > 1) {
      warnings.push('Script performs multiple delete operations - ensure data loss prevention measures are in place');
    }

    return warnings;
  }

  private static calculateSecurityLevel(violations: SecurityViolation[]): 'safe' | 'caution' | 'dangerous' {
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;
    const totalCount = violations.length;

    if (criticalCount > 0) return 'dangerous';
    if (highCount > 2 || totalCount > 10) return 'dangerous';
    if (highCount > 0 || totalCount > 5) return 'caution';
    
    return 'safe';
  }

  public static async validateScriptContent(content: string): Promise<ValidationResult> {
    const analysis = this.analyzeScript(content);
    const violations = this.checkSecurityViolations(content, analysis);
    const warnings = this.generateWarnings(analysis);
    const securityLevel = this.calculateSecurityLevel(violations);
    const hash = createHash('sha256').update(content).digest('hex');

    return {
      isValid: securityLevel !== 'dangerous',
      securityLevel,
      violations,
      warnings,
      hash,
      analysis
    };
  }
}

export default ScriptValidatorService;