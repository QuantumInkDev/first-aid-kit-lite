import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { 
  validateAndSanitize, 
  IpcMessageSchema,
  ExecuteScriptRequestSchema,
  CancelExecutionRequestSchema,
  LogFiltersSchema,
  ExportLogsRequestSchema,
  AppSettingsSchema,
  NotificationSchema,
  SessionStateSchema
} from '../../shared/validation/schemas';
import { securityLogger, ipcLogger } from './logger';
import { v4 as uuidv4 } from 'uuid';

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  skipValidation?: boolean; // Skip for certain channels
}

// Default rate limiting configuration
// Note: In development mode, React StrictMode causes double-renders, so limits are higher
const isDev = process.env.NODE_ENV === 'development';
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  'system:get-info': { windowMs: 60000, maxRequests: isDev ? 100 : 30 },
  'script:execute': { windowMs: 60000, maxRequests: 5 },
  'script:cancel': { windowMs: 60000, maxRequests: 10 },
  'script:get-all': { windowMs: 30000, maxRequests: 20 },
  'script:get-details': { windowMs: 30000, maxRequests: 50 },
  'log:get': { windowMs: 30000, maxRequests: 30 },
  'log:export': { windowMs: 300000, maxRequests: 2 }, // 5 minutes, 2 exports
  'settings:get': { windowMs: 60000, maxRequests: 20 },
  'settings:update': { windowMs: 60000, maxRequests: 10 },
  'notification:show': { windowMs: 60000, maxRequests: 30 },
  'session:save-state': { windowMs: 30000, maxRequests: 100 },
  'session:restore-state': { windowMs: 60000, maxRequests: 5 },
  'session:end-request': { windowMs: 60000, maxRequests: 3 }
};

// Rate limiting storage
const rateLimitStorage = new Map<string, Array<{ timestamp: number; channel: string }>>();

// Channel-specific validation schemas
const VALIDATION_SCHEMAS: Record<string, z.ZodSchema<any>> = {
  'script:execute': ExecuteScriptRequestSchema,
  'script:cancel': CancelExecutionRequestSchema,
  'script:get-details': z.object({ scriptId: z.string().min(1).max(100) }),
  'log:get': LogFiltersSchema.optional(),
  'log:export': ExportLogsRequestSchema,
  'settings:update': AppSettingsSchema.partial(),
  'notification:show': NotificationSchema,
  'session:save-state': SessionStateSchema,
  // Add more as needed
};

class IpcValidationService {
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Set up periodic cleanup of rate limit storage
    setInterval(() => {
      this.cleanupRateLimitStorage();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes

    this.isInitialized = true;
    ipcLogger.info('IPC validation service initialized');
  }

  private cleanupRateLimitStorage(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, requests] of rateLimitStorage.entries()) {
      // Remove requests older than the longest rate limit window (5 minutes)
      const filtered = requests.filter(req => now - req.timestamp < 300000);
      
      if (filtered.length === 0) {
        rateLimitStorage.delete(key);
        cleaned++;
      } else if (filtered.length !== requests.length) {
        rateLimitStorage.set(key, filtered);
      }
    }

    if (cleaned > 0) {
      ipcLogger.debug('Cleaned up rate limit storage', { cleanedEntries: cleaned });
    }
  }

  private checkRateLimit(channel: string, clientId: string = 'default'): boolean {
    const config = DEFAULT_RATE_LIMITS[channel];
    if (!config) {
      // No rate limit configured for this channel
      return true;
    }

    const key = `${clientId}:${channel}`;
    const now = Date.now();
    
    // Get existing requests for this client/channel
    let requests = rateLimitStorage.get(key) || [];
    
    // Filter out requests outside the time window
    requests = requests.filter(req => now - req.timestamp < config.windowMs);
    
    // Check if rate limit exceeded
    if (requests.length >= config.maxRequests) {
      securityLogger.warn('Rate limit exceeded', {
        channel,
        clientId,
        requestCount: requests.length,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs
      });
      return false;
    }

    // Add current request
    requests.push({ timestamp: now, channel });
    rateLimitStorage.set(key, requests);

    return true;
  }

  private validateChannelName(channel: string): boolean {
    // Channel must follow pattern: namespace:action-name
    const channelPattern = /^[a-z]+:[a-z-]+$/;
    return channelPattern.test(channel) && channel.length <= 100;
  }

  private sanitizeError(error: any): string {
    if (error instanceof Error) {
      return error.message.substring(0, 500); // Limit error message length
    }
    return String(error).substring(0, 500);
  }

  private logSecurityEvent(
    event: string, 
    details: Record<string, any>, 
    riskLevel: 'low' | 'medium' | 'high' = 'medium'
  ): void {
    securityLogger.warn(`IPC Security Event: ${event}`, {
      event,
      riskLevel,
      timestamp: Date.now(),
      ...details
    });
  }

  public validateIpcMessage<T = any>(
    channel: string,
    data: unknown,
    event?: IpcMainInvokeEvent
  ): { success: true; data: T } | { success: false; error: string } {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      // Step 1: Validate channel name format
      if (!this.validateChannelName(channel)) {
        this.logSecurityEvent('invalid_channel_format', { 
          channel, 
          requestId 
        }, 'high');
        return { success: false, error: 'Invalid channel format' };
      }

      // Step 2: Check rate limiting
      const clientId = event?.sender?.id?.toString() || 'unknown';
      if (!this.checkRateLimit(channel, clientId)) {
        this.logSecurityEvent('rate_limit_exceeded', { 
          channel, 
          clientId,
          requestId 
        }, 'high');
        return { success: false, error: 'Rate limit exceeded' };
      }

      // Step 3: Basic IPC message structure validation
      const messageValidation = validateAndSanitize(IpcMessageSchema, {
        channel,
        data,
        timestamp: Date.now()
      });

      if (!messageValidation.success) {
        this.logSecurityEvent('invalid_message_structure', { 
          channel, 
          error: messageValidation.error,
          requestId 
        });
        return { success: false, error: 'Invalid message structure' };
      }

      // Step 4: Channel-specific data validation
      const schema = VALIDATION_SCHEMAS[channel];
      if (schema) {
        const dataValidation = validateAndSanitize(schema, data, `Channel ${channel}`);
        
        if (!dataValidation.success) {
          this.logSecurityEvent('invalid_data_format', { 
            channel, 
            error: dataValidation.error,
            requestId 
          });
          return { success: false, error: dataValidation.error };
        }

        // Log successful validation
        ipcLogger.debug('IPC message validated successfully', {
          channel,
          requestId,
          duration: Date.now() - startTime,
          dataSize: JSON.stringify(data || null).length
        });

        return { success: true, data: dataValidation.data as T };
      } else {
        // No specific validation schema, but basic structure is valid
        ipcLogger.debug('IPC message validated (no specific schema)', {
          channel,
          requestId,
          duration: Date.now() - startTime
        });

        return { success: true, data: data as T };
      }

    } catch (error) {
      this.logSecurityEvent('validation_error', { 
        channel, 
        error: this.sanitizeError(error),
        requestId 
      }, 'high');

      ipcLogger.error('IPC validation failed', {
        channel,
        requestId,
        error: this.sanitizeError(error),
        duration: Date.now() - startTime
      });

      return { success: false, error: 'Validation failed' };
    }
  }

  public createValidatedHandler<TInput = any, TOutput = any>(
    channel: string,
    handler: (data: TInput, event: IpcMainInvokeEvent) => Promise<TOutput> | TOutput
  ): void {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, data: unknown) => {
      const requestId = uuidv4();
      const startTime = Date.now();

      try {
        // Validate the incoming message
        const validation = this.validateIpcMessage<TInput>(channel, data, event);
        
        if (!validation.success) {
          ipcLogger.warn('IPC request rejected', {
            channel,
            requestId,
            error: validation.error,
            clientId: event.sender.id
          });

          // Return a standardized error response
          throw new Error(validation.error);
        }

        // Log the validated request
        ipcLogger.info('IPC request processed', {
          channel,
          requestId,
          clientId: event.sender.id,
          dataSize: JSON.stringify(validation.data || null).length
        });

        // Execute the handler with validated data
        const result = await handler(validation.data, event);

        // Log successful completion
        ipcLogger.info('IPC request completed', {
          channel,
          requestId,
          duration: Date.now() - startTime,
          success: true
        });

        return result;

      } catch (error) {
        // Log the error
        ipcLogger.error('IPC request failed', {
          channel,
          requestId,
          error: this.sanitizeError(error),
          duration: Date.now() - startTime,
          clientId: event.sender.id
        });

        // Security log for unexpected errors
        this.logSecurityEvent('handler_error', {
          channel,
          requestId,
          error: this.sanitizeError(error)
        });

        // Re-throw to maintain standard Electron IPC error handling
        throw error;
      }
    });

    ipcLogger.info('IPC handler registered', { channel });
  }

  public removeHandler(channel: string): void {
    ipcMain.removeHandler(channel);
    ipcLogger.info('IPC handler removed', { channel });
  }

  public getRateLimitStatus(channel: string, clientId: string = 'default'): {
    channel: string;
    requestCount: number;
    maxRequests: number;
    windowMs: number;
    resetTime: Date;
  } | null {
    const config = DEFAULT_RATE_LIMITS[channel];
    if (!config) {
      return null;
    }

    const key = `${clientId}:${channel}`;
    const requests = rateLimitStorage.get(key) || [];
    const now = Date.now();
    
    // Filter active requests
    const activeRequests = requests.filter(req => now - req.timestamp < config.windowMs);
    
    // Calculate reset time (when the oldest request expires)
    const oldestRequest = activeRequests[0];
    const resetTime = oldestRequest 
      ? new Date(oldestRequest.timestamp + config.windowMs)
      : new Date(now);

    return {
      channel,
      requestCount: activeRequests.length,
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      resetTime
    };
  }

  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  } {
    const now = Date.now();
    const totalStorageEntries = rateLimitStorage.size;
    const totalActiveRequests = Array.from(rateLimitStorage.values())
      .flat()
      .filter(req => now - req.timestamp < 300000) // 5 minutes
      .length;

    const status = totalStorageEntries > 10000 ? 'degraded' : 
                  totalActiveRequests > 1000 ? 'degraded' : 'healthy';

    return {
      status,
      details: {
        isInitialized: this.isInitialized,
        totalStorageEntries,
        totalActiveRequests,
        registeredChannels: Object.keys(VALIDATION_SCHEMAS).length,
        rateLimitConfigs: Object.keys(DEFAULT_RATE_LIMITS).length
      }
    };
  }
}

// Create and export singleton instance
let ipcValidationService: IpcValidationService | null = null;

export const getIpcValidationService = (): IpcValidationService => {
  if (!ipcValidationService) {
    ipcValidationService = new IpcValidationService();
  }
  return ipcValidationService;
};

// Convenience function for quick validation
export const validateIpcMessage = <T = any>(
  channel: string,
  data: unknown,
  event?: IpcMainInvokeEvent
): { success: true; data: T } | { success: false; error: string } => {
  return getIpcValidationService().validateIpcMessage<T>(channel, data, event);
};

// Convenience function for creating validated handlers
export const createValidatedIpcHandler = <TInput = any, TOutput = any>(
  channel: string,
  handler: (data: TInput, event: IpcMainInvokeEvent) => Promise<TOutput> | TOutput
): void => {
  getIpcValidationService().createValidatedHandler<TInput, TOutput>(channel, handler);
};

export default getIpcValidationService;