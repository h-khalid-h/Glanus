import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
}

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
}

winston.addColors(colors)

// JSON format for structured logging (production + files)
const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
)

// Console format for development (human-readable)
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(
        info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
    )
)

/**
 * Build transports based on environment:
 * - Development: colorized console + file rotation
 * - Production/Container: JSON to stdout/stderr (for log aggregation)
 */
function buildTransports(): winston.transport[] {
    const isProduction = process.env.NODE_ENV === 'production'
    const isContainer = process.env.CONTAINER === 'true' || process.env.KUBERNETES_SERVICE_HOST

    if (isProduction && isContainer) {
        // Container mode: log to stdout/stderr only (JSON format)
        // Log aggregators (CloudWatch, Datadog, ELK) collect from stdout
        return [
            new winston.transports.Console({
                format: jsonFormat,
            }),
        ]
    }

    if (isProduction) {
        // Production but not container: JSON console + file rotation
        return [
            new winston.transports.Console({
                format: jsonFormat,
            }),
            new DailyRotateFile({
                filename: 'logs/application-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                maxSize: '20m',
                maxFiles: '14d',
                format: jsonFormat,
            }),
            new DailyRotateFile({
                filename: 'logs/error-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                level: 'error',
                maxSize: '20m',
                maxFiles: '30d',
                format: jsonFormat,
            }),
        ]
    }

    // Development: human-readable console + file rotation
    return [
        new winston.transports.Console({
            format: consoleFormat,
        }),
        new DailyRotateFile({
            filename: 'logs/application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: jsonFormat,
        }),
        new DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '30d',
            format: jsonFormat,
        }),
    ]
}

// Create the logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    levels,
    format: jsonFormat,
    transports: buildTransports(),
    // Only use file-based exception handlers when NOT in container
    ...(process.env.CONTAINER !== 'true' && !process.env.KUBERNETES_SERVICE_HOST
        ? {
            exceptionHandlers: [
                new DailyRotateFile({
                    filename: 'logs/exceptions-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '20m',
                    maxFiles: '30d',
                }),
            ],
            rejectionHandlers: [
                new DailyRotateFile({
                    filename: 'logs/rejections-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '20m',
                    maxFiles: '30d',
                }),
            ],
        }
        : {}),
})

// Helper functions for easier logging
export const logError = (message: string, error?: unknown, meta?: object) => {
    const errorObj = error instanceof Error ? error : null;
    logger.error(message, { error: errorObj?.message || String(error), stack: errorObj?.stack, ...meta })
}

export const logWarn = (message: string, meta?: object) => {
    logger.warn(message, meta)
}

export const logInfo = (message: string, meta?: object) => {
    logger.info(message, meta)
}

export const logHttp = (message: string, meta?: object) => {
    logger.http(message, meta)
}

export const logDebug = (message: string, meta?: object) => {
    logger.debug(message, meta)
}

export default logger
