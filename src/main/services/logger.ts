import winston from 'winston';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Define log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
} as const;

// Define log colors
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow', 
  info: 'cyan',
  verbose: 'blue',
  debug: 'magenta',
} as const;

// Add colors to winston
winston.addColors(LOG_COLORS);

// Get user data path for logs
const userDataPath = app.getPath('userData');
const logsDir = join(userDataPath, 'logs');

// Ensure logs directory exists
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'HH:mm:ss.SSS',
  }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    let output = `${timestamp} [${level}]`;
    if (service) {
      output += ` [${service}]`;
    }
    output += `: ${message}`;
    
    // Add metadata if present
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
    if (metaStr) {
      output += `\n${metaStr}`;
    }
    
    return output;
  })
);

// Create logger transports
const transports: winston.transport[] = [
  // Main application log file with rotation
  new winston.transports.File({
    filename: join(logsDir, 'application.log'),
    level: 'info',
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    tailable: true,
  }),
  
  // Error-only log file
  new winston.transports.File({
    filename: join(logsDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true,
  }),
  
  // Security events log file
  new winston.transports.File({
    filename: join(logsDir, 'security.log'),
    level: 'warn',
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    tailable: true,
  }),
];

// Add console transport in development
if (process.env.NODE_ENV === 'development') {
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: consoleFormat,
    })
  );
} else {
  // In production, only show warnings and errors on console
  transports.push(
    new winston.transports.Console({
      level: 'warn',
      format: consoleFormat,
    })
  );
}

// Create the main logger
const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports,
  // Prevent crashes on uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: join(logsDir, 'exceptions.log'),
      format: logFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: join(logsDir, 'rejections.log'),
      format: logFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
    }),
  ],
});

// Specialized logger functions
export const createServiceLogger = (serviceName: string) => {
  return logger.child({ service: serviceName });
};

// Security logger for audit trails
export const securityLogger = logger.child({ 
  service: 'security',
  category: 'audit'
});

// Script execution logger
export const scriptLogger = logger.child({
  service: 'script-execution',
  category: 'powershell'
});

// Protocol handler logger
export const protocolLogger = logger.child({
  service: 'protocol-handler',
  category: 'browser-integration'
});

// IPC logger
export const ipcLogger = logger.child({
  service: 'ipc',
  category: 'communication'
});

// Main logger instance
export default logger;

// Log startup information
logger.info('Logger initialized', {
  logLevel: logger.level,
  logsDirectory: logsDir,
  nodeEnv: process.env.NODE_ENV,
  transportCount: transports.length,
});

// Handle process events
process.on('exit', (code) => {
  logger.info('Application shutting down', { exitCode: code });
});

process.on('SIGTERM', () => {
  logger.warn('Received SIGTERM signal');
});

process.on('SIGINT', () => {
  logger.warn('Received SIGINT signal');
});