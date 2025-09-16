import { z } from 'zod';

// Base validation schemas
export const IdSchema = z.string().uuid('Invalid UUID format').describe('Unique identifier');

export const TimestampSchema = z.number()
  .int('Timestamp must be an integer')
  .positive('Timestamp must be positive')
  .describe('Unix timestamp in milliseconds');

export const NonEmptyStringSchema = z.string()
  .min(1, 'String cannot be empty')
  .max(10000, 'String too long');

export const SafeStringSchema = z.string()
  .regex(/^[\w\s\-_.,:;()\[\]{}'"!?@#$%^&*+=|\\/<>]+$/, 
    'String contains invalid characters')
  .max(1000, 'String too long');

// System information validation
export const SystemInfoSchema = z.object({
  platform: z.enum(['win32', 'darwin', 'linux'], {
    errorMap: () => ({ message: 'Unsupported platform' })
  }),
  version: z.string().min(1, 'Version required'),
  arch: z.enum(['x64', 'arm64', 'x32'], {
    errorMap: () => ({ message: 'Unsupported architecture' })
  }),
  powershellVersion: z.string().min(1, 'PowerShell version required'),
  isElevated: z.boolean()
});

// Script definition validation
export const ScriptParameterSchema = z.object({
  name: SafeStringSchema.max(100, 'Parameter name too long'),
  type: z.enum(['string', 'number', 'boolean', 'select'], {
    errorMap: () => ({ message: 'Invalid parameter type' })
  }),
  required: z.boolean(),
  description: SafeStringSchema.max(500, 'Description too long'),
  options: z.array(SafeStringSchema.max(100)).optional(),
  default: z.any().optional()
});

export const ScriptDefinitionSchema = z.object({
  id: SafeStringSchema.regex(/^[a-z0-9-_]+$/, 'Invalid script ID format').max(100),
  name: SafeStringSchema.max(200, 'Script name too long'),
  description: SafeStringSchema.max(1000, 'Description too long'),
  scriptPath: SafeStringSchema.max(500, 'Script path too long'),
  riskLevel: z.enum(['low', 'medium', 'high'], {
    errorMap: () => ({ message: 'Invalid risk level' })
  }),
  timeout: z.number()
    .int('Timeout must be an integer')
    .min(1000, 'Timeout must be at least 1 second')
    .max(3600000, 'Timeout too long (max 1 hour)'), // milliseconds
  category: SafeStringSchema.max(100, 'Category name too long'),
  version: SafeStringSchema.max(20, 'Version string too long').optional(),
  author: SafeStringSchema.max(100, 'Author name too long').optional(),
  tags: z.array(SafeStringSchema.max(50)).max(20, 'Too many tags').optional(),
  estimatedDuration: z.number()
    .int('Duration must be an integer')
    .min(0, 'Duration cannot be negative')
    .max(3600000, 'Duration too long (max 1 hour)'), // milliseconds
  requiredPermissions: z.array(SafeStringSchema.max(100)).max(10, 'Too many permissions'),
  lastModified: z.number().int().min(0, 'Last modified timestamp must be non-negative'),
  fileSize: z.number().int().min(0, 'File size must be non-negative'),
  parameters: z.array(ScriptParameterSchema).optional(),
  hash: SafeStringSchema.max(128, 'Hash too long').optional()
});

// Execution validation
export const ExecuteScriptRequestSchema = z.object({
  scriptId: SafeStringSchema.regex(/^[a-z0-9-_]+$/, 'Invalid script ID format').max(100),
  parameters: z.record(z.string().max(100), z.any()).optional()
}).refine((data) => {
  // Additional validation: parameter keys should be safe
  if (data.parameters) {
    const keys = Object.keys(data.parameters);
    return keys.every(key => /^[a-zA-Z0-9_]+$/.test(key));
  }
  return true;
}, {
  message: 'Parameter keys contain invalid characters'
});

export const CancelExecutionRequestSchema = z.object({
  executionId: IdSchema
});

export const ExecutionResultSchema = z.object({
  id: IdSchema,
  success: z.boolean(),
  output: z.string().max(100000, 'Output too large').optional(),
  error: z.string().max(10000, 'Error message too large').optional(),
  duration: z.number().int().min(0, 'Duration must be non-negative'),
  exitCode: z.number().int().min(-2147483648).max(2147483647), // 32-bit signed integer
  timestamp: z.number().int().min(0, 'Timestamp must be non-negative')
});

// Logging validation
export const LogFiltersSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: z.array(z.enum(['pending', 'running', 'success', 'error', 'cancelled']))
    .max(5, 'Too many status filters')
    .optional(),
  scriptIds: z.array(SafeStringSchema.max(100))
    .max(20, 'Too many script ID filters')
    .optional(),
  limit: z.number().int().min(1, 'Limit must be at least 1').max(1000, 'Limit too high').optional()
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }
  return true;
}, {
  message: 'Start date must be before or equal to end date'
});

export const ExportLogsRequestSchema = z.object({
  format: z.enum(['json', 'csv'], {
    errorMap: () => ({ message: 'Invalid export format' })
  }),
  filters: LogFiltersSchema.optional()
});

// Settings validation
export const AppSettingsSchema = z.object({
  confirmationRequired: z.boolean(),
  notificationLevel: z.enum(['all', 'errors', 'none'], {
    errorMap: () => ({ message: 'Invalid notification level' })
  }),
  logRetentionDays: z.number()
    .int('Log retention must be an integer')
    .min(1, 'Log retention must be at least 1 day')
    .max(365, 'Log retention cannot exceed 365 days'),
  theme: z.enum(['light', 'dark', 'system'], {
    errorMap: () => ({ message: 'Invalid theme' })
  }),
  maxConcurrentExecutions: z.number()
    .int('Max concurrent executions must be an integer')
    .min(1, 'Must allow at least 1 concurrent execution')
    .max(10, 'Cannot exceed 10 concurrent executions'),
  scriptTimeout: z.number()
    .int('Script timeout must be an integer')
    .min(5000, 'Script timeout must be at least 5 seconds')
    .max(3600000, 'Script timeout cannot exceed 1 hour'), // milliseconds
  enableDetailedLogging: z.boolean()
});

// Notification validation
export const NotificationSchema = z.object({
  type: z.enum(['success', 'error', 'warning', 'info'], {
    errorMap: () => ({ message: 'Invalid notification type' })
  }),
  message: SafeStringSchema.max(500, 'Notification message too long'),
  options: z.object({
    duration: z.number().int().min(1000).max(30000).optional(), // 1-30 seconds
    persistent: z.boolean().optional(),
    actions: z.array(z.object({
      label: SafeStringSchema.max(50, 'Action label too long'),
      action: SafeStringSchema.max(100, 'Action identifier too long')
    })).max(3, 'Too many notification actions').optional()
  }).optional()
});

// Protocol URL validation
export const ProtocolUrlSchema = z.string()
  .url('Invalid URL format')
  .refine((url) => {
    const parsed = new URL(url);
    return ['first-aid-kit', 'fak'].includes(parsed.protocol.replace(':', ''));
  }, {
    message: 'URL must use first-aid-kit:// or fak:// protocol'
  })
  .refine((url) => {
    // Additional security: prevent overly long URLs
    return url.length <= 2048;
  }, {
    message: 'URL too long'
  });

// Session management validation
export const WindowBoundsSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(400, 'Window width too small').max(4000, 'Window width too large'),
  height: z.number().int().min(300, 'Window height too small').max(3000, 'Window height too large')
});

export const SessionStateSchema = z.object({
  windowBounds: WindowBoundsSchema,
  isMaximized: z.boolean(),
  lastActiveScript: SafeStringSchema.max(100).optional(),
  pendingExecutions: z.array(z.object({
    executionId: IdSchema,
    status: z.enum(['running', 'success', 'error', 'cancelled']),
    progress: z.number().min(0).max(100).optional(),
    output: z.string().max(10000).optional(),
    error: z.string().max(1000).optional()
  })).max(10, 'Too many pending executions'),
  unsavedSettings: AppSettingsSchema.partial(),
  sessionTimestamp: TimestampSchema
});

// Audit logging validation
export const AuditLogSchema = z.object({
  id: IdSchema,
  timestamp: TimestampSchema,
  eventType: SafeStringSchema.max(100, 'Event type too long'),
  userAction: SafeStringSchema.max(200, 'User action too long'),
  resource: SafeStringSchema.max(200, 'Resource identifier too long'),
  details: z.string().max(2000, 'Details too long').optional(),
  ipAddress: z.string()
    .ip({ message: 'Invalid IP address format' })
    .optional(),
  userAgent: z.string().max(500, 'User agent too long').optional(),
  riskLevel: z.enum(['low', 'medium', 'high'], {
    errorMap: () => ({ message: 'Invalid risk level' })
  })
});

// IPC message validation wrapper
export const IpcMessageSchema = z.object({
  channel: SafeStringSchema.max(100, 'Channel name too long'),
  data: z.any(),
  timestamp: TimestampSchema.optional()
}).refine((data) => {
  // Channel name should follow specific pattern
  return /^[a-z]+:[a-z-]+$/.test(data.channel);
}, {
  message: 'Channel name must follow pattern: namespace:action-name'
});

// Security validation helpers
export const sanitizeInput = <T>(schema: z.ZodSchema<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`);
  }
  
  return result.data;
};

export const validateAndSanitize = <T>(
  schema: z.ZodSchema<T>, 
  input: unknown,
  context?: string
): { success: true; data: T } | { success: false; error: string } => {
  const result = schema.safeParse(input);
  
  if (!result.success) {
    const errorMessage = context 
      ? `${context}: ${result.error.message}`
      : result.error.message;
    
    return { success: false, error: errorMessage };
  }
  
  return { success: true, data: result.data };
};

// Export commonly used type inferences
export type SystemInfo = z.infer<typeof SystemInfoSchema>;
export type ScriptDefinition = z.infer<typeof ScriptDefinitionSchema>;
export type ScriptParameter = z.infer<typeof ScriptParameterSchema>;
export type ExecuteScriptRequest = z.infer<typeof ExecuteScriptRequestSchema>;
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
export type LogFilters = z.infer<typeof LogFiltersSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type NotificationData = z.infer<typeof NotificationSchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type AuditLog = z.infer<typeof AuditLogSchema>;
export type IpcMessage = z.infer<typeof IpcMessageSchema>;