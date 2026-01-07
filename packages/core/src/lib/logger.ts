/**
 * Logger Utility
 * Provides centralized logging using Winston
 * Default: Console output with timestamps and colors
 * Supports: File logging with daily rotation
 */

import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LoggerConfig {
  level: LogLevel
  enableTimestamp: boolean
  enableColors: boolean
  prefix?: string
  enableFileLogging?: boolean
  logDir?: string
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enableTimestamp: true,
  enableColors: true,
  enableFileLogging: false,
  logDir: './logs',
}

// Custom format for console output with colors and emojis
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'ISO' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, label, ...meta }) => {
    const emoji = getEmoji(level)
    const prefix = label ? `[${label}] ` : ''
    const metaStr =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''

    // Color codes for different levels
    const colorCodes: Record<string, string> = {
      error: '\x1b[31m', // red
      warn: '\x1b[33m', // yellow
      info: '\x1b[34m', // blue
      debug: '\x1b[90m', // gray
      success: '\x1b[32m', // green
    }

    const reset = '\x1b[0m'
    const color = colorCodes[level] || ''
    const levelUpper = level.toUpperCase().padEnd(5)

    return `${timestamp} ${color}[${emoji} ${levelUpper}]${reset} ${prefix}${message}${metaStr}`
  }),
)

// Format for file output (JSON with timestamp)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'ISO' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
)

// Get emoji for log level
function getEmoji(level: string): string {
  const emojis: Record<string, string> = {
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    debug: '🔍',
  }
  return emojis[level] || '📝'
}

/**
 * Logger class wrapping Winston
 */
export class Logger {
  private winstonLogger: winston.Logger
  private config: LoggerConfig

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    const transports: winston.transport[] = [
      // Console transport
      new winston.transports.Console({
        format: consoleFormat,
        level: this.config.level,
      }),
    ]

    // Add file transport if enabled
    if (this.config.enableFileLogging) {
      const logDir = this.config.logDir || './logs'

      // Combined log file (all levels)
      transports.push(
        new DailyRotateFile({
          filename: `${logDir}/combined-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: fileFormat,
          level: 'debug',
        }),
      )

      // Error log file (only errors)
      transports.push(
        new DailyRotateFile({
          filename: `${logDir}/error-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          format: fileFormat,
          level: 'error',
        }),
      )
    }

    this.winstonLogger = winston.createLogger({
      level: this.config.level,
      transports,
      exitOnError: false,
    })
  }

  /**
   * Update logger configuration
   * Note: This creates a new logger instance with the new config
   */
  configure(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config }
    this.winstonLogger.level = this.config.level
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.config.level as LogLevel
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel) {
    this.config.level = level
    this.winstonLogger.level = level
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ) {
    this.winstonLogger.log(level, message, meta)
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, meta)
  }

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, meta)
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, meta)
  }

  /**
   * Log error message
   */
  error(message: string, error?: unknown) {
    // If error is provided, include it in metadata
    const meta =
      error instanceof Error
        ? { message: error.message, stack: error.stack, ...error }
        : error

    this.log(LogLevel.ERROR, message, meta as Record<string, unknown>)
  }

  /**
   * Log success message (info with green checkmark)
   */
  success(message: string, meta?: Record<string, unknown>) {
    this.winstonLogger.log('info', message, {
      ...meta,
      _success: true,
    })
  }

  /**
   * Log section header (for grouping related logs)
   */
  section(title: string) {
    const line = '═'.repeat(Math.max(60, title.length + 4))
    this.winstonLogger.log('info', `\n${line}\n  ${title}\n${line}\n`)
  }

  /**
   * Create a child logger with a prefix (label in Winston)
   */
  child(prefix: string): Logger {
    const childConfig = {
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    }

    const childLogger = new Logger(childConfig)

    // Set default metadata for all log messages
    childLogger.winstonLogger.defaultMeta = {
      label: childConfig.prefix,
    }

    return childLogger
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger()

/**
 * Create a named logger instance
 */
export function createLogger(name: string): Logger {
  const instance = new Logger()
  instance.winstonLogger.defaultMeta = { label: name }
  return instance
}

/**
 * Set global log level for all loggers
 */
export function setGlobalLogLevel(level: LogLevel) {
  logger.setLevel(level)
  winston.level = level
}
