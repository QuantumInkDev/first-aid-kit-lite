import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { app } from 'electron';
import { createServiceLogger } from './logger';
import { validateAndSanitize, ScriptDefinitionSchema } from '../../shared/validation/schemas';

const logger = createServiceLogger('script-registry');

export interface ScriptDefinition {
  id: string;
  name: string;
  description: string;
  scriptPath: string;
  parameters?: ScriptParameter[];
  timeout: number;
  category: string;
  version?: string;
  author?: string;
  tags?: string[];
  estimatedDuration: number;
  lastModified: number;
  fileSize: number;
  hash?: string;
}

export interface ScriptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
  description: string;
  options?: string[];
  default?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    allowedValues?: string[];
  };
}

export interface ScriptMetadata {
  name?: string;
  description?: string;
  timeout?: number;
  category?: string;
  version?: string;
  author?: string;
  tags?: string[];
  estimatedDuration?: number;
  parameters?: ScriptParameter[];
}

export interface ScriptDiscoveryConfig {
  scriptDirectories: string[];
  allowedExtensions: string[];
  maxScriptSize: number; // bytes
  enableMetadataComments: boolean;
  enableJsonMetadata: boolean;
  scanSubdirectories: boolean;
}

class ScriptRegistryService {
  private scripts: Map<string, ScriptDefinition> = new Map();
  private scriptsDirectory: string;
  private initialized = false;
  private discoveryConfig: ScriptDiscoveryConfig;
  private initPromise: Promise<void>;

  constructor() {
    this.scriptsDirectory = join(app.getPath('userData'), 'scripts');

    this.discoveryConfig = {
      scriptDirectories: [
        this.scriptsDirectory,
        join(__dirname, '../../scripts'), // Bundled scripts (dist/main -> FAKL root)
      ],
      allowedExtensions: ['.ps1', '.psm1'],
      maxScriptSize: 10 * 1024 * 1024, // 10MB max
      enableMetadataComments: true,
      enableJsonMetadata: true,
      scanSubdirectories: true,
    };

    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('Initializing script registry service...');
      
      // Ensure scripts directory exists
      this.ensureScriptDirectories();
      
      // Discover and load all scripts
      await this.discoverScripts();
      
      this.initialized = true;
      logger.info('Script registry service initialized successfully', {
        scriptCount: this.scripts.size,
        directories: this.discoveryConfig.scriptDirectories
      });

    } catch (error) {
      logger.error('Failed to initialize script registry service', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private ensureScriptDirectories(): void {
    for (const dir of this.discoveryConfig.scriptDirectories) {
      if (!existsSync(dir)) {
        try {
          const { mkdirSync } = require('fs');
          mkdirSync(dir, { recursive: true });
          logger.info('Created script directory', { directory: dir });
        } catch (error) {
          logger.warn('Could not create script directory', { 
            directory: dir,
            error: (error as Error).message
          });
        }
      }
    }
  }

  private async discoverScripts(): Promise<void> {
    logger.info('Starting script discovery...');
    let discoveredCount = 0;

    for (const directory of this.discoveryConfig.scriptDirectories) {
      if (!existsSync(directory)) {
        logger.debug('Script directory does not exist, skipping', { directory });
        continue;
      }

      const scripts = await this.scanDirectory(directory);
      discoveredCount += scripts.length;

      for (const scriptPath of scripts) {
        try {
          await this.loadScript(scriptPath);
        } catch (error) {
          logger.warn('Failed to load script', {
            scriptPath,
            error: (error as Error).message
          });
        }
      }
    }

    logger.info('Script discovery completed', {
      discoveredCount,
      loadedCount: this.scripts.size
    });
  }

  private async scanDirectory(directory: string): Promise<string[]> {
    const scripts: string[] = [];

    try {
      const items = readdirSync(directory);

      for (const item of items) {
        const fullPath = join(directory, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && this.discoveryConfig.scanSubdirectories) {
          // Recursively scan subdirectories
          const subScripts = await this.scanDirectory(fullPath);
          scripts.push(...subScripts);
        } else if (stat.isFile()) {
          const ext = extname(item).toLowerCase();
          
          if (this.discoveryConfig.allowedExtensions.includes(ext)) {
            // Check file size
            if (stat.size <= this.discoveryConfig.maxScriptSize) {
              scripts.push(fullPath);
            } else {
              logger.warn('Script file too large, skipping', {
                scriptPath: fullPath,
                size: stat.size,
                maxSize: this.discoveryConfig.maxScriptSize
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error scanning directory', {
        directory,
        error: (error as Error).message
      });
    }

    return scripts;
  }

  private async loadScript(scriptPath: string): Promise<void> {
    try {
      const stat = statSync(scriptPath);
      const scriptContent = readFileSync(scriptPath, 'utf8');
      
      // Generate script ID from file path
      const scriptId = this.generateScriptId(scriptPath);
      
      // Parse metadata from script
      const metadata = await this.parseScriptMetadata(scriptPath, scriptContent);
      
      // Create script definition
      const scriptDef: ScriptDefinition = {
        id: scriptId,
        name: metadata.name || this.generateDisplayName(scriptPath),
        description: metadata.description || 'No description available',
        scriptPath,
        timeout: metadata.timeout || 30000, // 30 seconds default
        category: metadata.category || 'uncategorized',
        version: metadata.version || '1.0.0',
        author: metadata.author || 'Unknown',
        tags: metadata.tags || [],
        estimatedDuration: metadata.estimatedDuration || 5000, // 5 seconds default
        parameters: metadata.parameters || [],
        lastModified: stat.mtime.getTime(),
        fileSize: stat.size,
      };

      // Validate script definition
      const validation = validateAndSanitize(ScriptDefinitionSchema, scriptDef);
      if (!validation.success) {
        throw new Error(`Script validation failed: ${validation.error}`);
      }

      // Store script
      this.scripts.set(scriptId, validation.data);
      
      logger.debug('Script loaded successfully', {
        scriptId,
        name: scriptDef.name,
        path: scriptPath
      });

    } catch (error) {
      logger.error('Failed to load script', {
        scriptPath,
        error: (error as Error).message
      });
      throw error;
    }
  }

  private generateScriptId(scriptPath: string): string {
    // Create a consistent ID from the script path
    const relativePath = scriptPath.replace(this.scriptsDirectory, '');
    const name = basename(scriptPath, extname(scriptPath));
    
    // Convert to lowercase and replace invalid characters
    return `${relativePath}/${name}`.toLowerCase()
      .replace(/[^a-z0-9-_/]/g, '-')
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '')
      .replace(/\//g, '-');
  }

  private generateDisplayName(scriptPath: string): string {
    const name = basename(scriptPath, extname(scriptPath));
    
    // Convert from kebab-case or snake_case to Title Case
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  private async parseScriptMetadata(scriptPath: string, content: string): Promise<ScriptMetadata> {
    const metadata: ScriptMetadata = {};

    // Try to load JSON metadata file first
    if (this.discoveryConfig.enableJsonMetadata) {
      const metadataPath = scriptPath.replace(extname(scriptPath), '.json');
      if (existsSync(metadataPath)) {
        try {
          const jsonMetadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
          Object.assign(metadata, jsonMetadata);
          
          logger.debug('Loaded JSON metadata', { 
            scriptPath, 
            metadataPath 
          });
        } catch (error) {
          logger.warn('Failed to parse JSON metadata', {
            scriptPath,
            metadataPath,
            error: (error as Error).message
          });
        }
      }
    }

    // Parse comment-based metadata
    if (this.discoveryConfig.enableMetadataComments) {
      const commentMetadata = this.parseCommentMetadata(content);
      Object.assign(metadata, commentMetadata);
    }

    return metadata;
  }

  private parseCommentMetadata(content: string): ScriptMetadata {
    const metadata: ScriptMetadata = {};
    const lines = content.split('\n');
    
    // Look for metadata in comments at the top of the file
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      const line = lines[i].trim();
      
      // Skip non-comment lines
      if (!line.startsWith('#')) {
        if (line && !line.startsWith('<#')) break; // Stop at first non-comment, non-empty line
        continue;
      }

      // Parse metadata from comments
      const cleanLine = line.substring(1).trim();
      
      // Parse key-value pairs like: # @name: Script Name
      const metadataMatch = cleanLine.match(/^@(\w+):\s*(.+)$/);
      if (metadataMatch) {
        const [, key, value] = metadataMatch;
        
        switch (key.toLowerCase()) {
          case 'name':
            metadata.name = value;
            break;
          case 'description':
            metadata.description = value;
            break;
          case 'timeout':
            const timeout = parseInt(value);
            if (!isNaN(timeout)) metadata.timeout = timeout * 1000; // Convert to ms
            break;
          case 'category':
            metadata.category = value;
            break;
          case 'version':
            metadata.version = value;
            break;
          case 'author':
            metadata.author = value;
            break;
          case 'tags':
            metadata.tags = value.split(',').map(tag => tag.trim());
            break;
          case 'duration':
          case 'estimatedduration':
            const duration = parseInt(value);
            if (!isNaN(duration)) metadata.estimatedDuration = duration * 1000; // Convert to ms
            break;
        }
      }
    }

    return metadata;
  }

  public getScript(scriptId: string): ScriptDefinition | null {
    if (!this.initialized) {
      logger.warn('Script registry not initialized');
      return null;
    }

    return this.scripts.get(scriptId) || null;
  }

  public getAllScripts(): ScriptDefinition[] {
    if (!this.initialized) {
      logger.warn('Script registry not initialized');
      return [];
    }

    return Array.from(this.scripts.values());
  }

  public getScriptsByCategory(category: string): ScriptDefinition[] {
    if (!this.initialized) {
      return [];
    }

    return this.getAllScripts().filter(script =>
      script.category.toLowerCase() === category.toLowerCase()
    );
  }

  public searchScripts(query: string): ScriptDefinition[] {
    if (!this.initialized || !query) {
      return [];
    }

    const normalizedQuery = query.toLowerCase();
    
    return this.getAllScripts().filter(script => 
      script.name.toLowerCase().includes(normalizedQuery) ||
      script.description.toLowerCase().includes(normalizedQuery) ||
      script.category.toLowerCase().includes(normalizedQuery) ||
      script.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery)) ||
      script.id.toLowerCase().includes(normalizedQuery)
    );
  }

  public async reloadScript(scriptId: string): Promise<boolean> {
    const existingScript = this.scripts.get(scriptId);
    if (!existingScript) {
      logger.warn('Script not found for reload', { scriptId });
      return false;
    }

    try {
      await this.loadScript(existingScript.scriptPath);
      logger.info('Script reloaded successfully', { scriptId });
      return true;
    } catch (error) {
      logger.error('Failed to reload script', {
        scriptId,
        error: (error as Error).message
      });
      return false;
    }
  }

  public async refreshRegistry(): Promise<void> {
    logger.info('Refreshing script registry...');
    
    this.scripts.clear();
    await this.discoverScripts();
    
    logger.info('Script registry refreshed', {
      scriptCount: this.scripts.size
    });
  }

  public getRegistryStats(): {
    totalScripts: number;
    scriptsByCategory: Record<string, number>;
    lastRefresh: number;
  } {
    const scripts = this.getAllScripts();
    const scriptsByCategory: Record<string, number> = {};

    for (const script of scripts) {
      const category = script.category;
      scriptsByCategory[category] = (scriptsByCategory[category] || 0) + 1;
    }

    return {
      totalScripts: scripts.length,
      scriptsByCategory,
      lastRefresh: Date.now()
    };
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async waitForInitialization(): Promise<void> {
    await this.initPromise;
  }

  public getScriptsDirectory(): string {
    return this.scriptsDirectory;
  }

  public getDiscoveryConfig(): ScriptDiscoveryConfig {
    return { ...this.discoveryConfig };
  }
}

// Create and export singleton instance
let scriptRegistryService: ScriptRegistryService | null = null;

export const getScriptRegistryService = (): ScriptRegistryService => {
  if (!scriptRegistryService) {
    scriptRegistryService = new ScriptRegistryService();
  }
  return scriptRegistryService;
};

export default getScriptRegistryService;