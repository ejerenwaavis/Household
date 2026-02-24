/**
 * Winston Logger Configuration
 * Structured logging for production-grade observability
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(process.cwd(), 'logs');

// Define log levels with colors
const customColors = {
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  http: 'magenta',
  debug: 'cyan'
};

winston.addColors(customColors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define file transports
const transports = [
  // Error logs
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),

  // Combined logs
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 10
  }),

  // HTTP logs
  new winston.transports.File({
    filename: path.join(logsDir, 'http.log'),
    level: 'http',
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
];

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ colors: customColors }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `[${timestamp}] ${level}: ${message} ${metaStr}`;
        })
      )
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format,
  defaultMeta: { service: 'household-api' },
  transports: transports
});

// Log unhandled exceptions
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'exceptions.log'),
    format: format
  })
);

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at Promise', {
    reason: reason,
    promise: promise
  });
});

/**
 * HTTP request logger middleware
 */
export const httpLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
};

/**
 * Error logger middleware
 */
export const errorLogger = (err, req, res, next) => {
  logger.error(`Error on ${req.method} ${req.originalUrl}`, {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    ip: req.ip
  });

  next(err);
};

/**
 * Conditional loggers for specific operations
 */

export const logAuthActivity = (activity, details) => {
  logger.info(`AUTH: ${activity}`, details);
};

export const logDatabaseOperation = (operation, model, details) => {
  logger.info(`DB: ${operation} on ${model}`, details);
};

export const logValidationError = (route, errors) => {
  logger.warn(`Validation Error on ${route}`, {
    errors: errors
  });
};

export const logBusinessLogicError = (operation, errors) => {
  logger.error(`Business Logic Error: ${operation}`, {
    errors: errors
  });
};

export const logSecurityEvent = (event, details) => {
  logger.warn(`SECURITY: ${event}`, details);
};

/**
 * Performance logger
 */
export const logPerformance = (operation, duration, threshold = 1000) => {
  if (duration > threshold) {
    logger.warn(`SLOW: ${operation} took ${duration}ms`, {
      operation: operation,
      duration: `${duration}ms`,
      threshold: `${threshold}ms`
    });
  } else {
    logger.debug(`${operation} completed in ${duration}ms`, {
      operation: operation,
      duration: `${duration}ms`
    });
  }
};

export default logger;
