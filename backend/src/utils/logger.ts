import winston from 'winston';
import path from 'path';

/**
 * Winston logger configuration for the application
 * Requirement 19.1, 19.2: Error logging and event logging
 */

// Determine log level from environment or default to 'info'
const logLevel = process.env.LOG_LEVEL || 'info';

// Create logs directory path
const logsDir = path.join(process.cwd(), 'logs');

/**
 * Custom format for console output with colors
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

/**
 * JSON format for file output
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Winston logger instance
 */
export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'plataforma-inteligencia-comercial' },
  transports: [
    // Console transport for all logs
    new winston.transports.Console({
      format: consoleFormat,
    }),
    
    // File transport for error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
    }),
  ],
});

/**
 * Log application startup
 */
export const logStartup = (port: number): void => {
  logger.info('Application started', {
    port,
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel,
  });
};

/**
 * Log application shutdown
 */
export const logShutdown = (signal: string): void => {
  logger.info('Application shutting down', { signal });
};

/**
 * Create a child logger with additional context
 */
export const createChildLogger = (context: Record<string, any>) => {
  return logger.child(context);
};
