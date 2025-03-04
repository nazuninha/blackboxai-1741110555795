const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Create logs directory if it doesn't exist
const logsDir = config.paths.logs;
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define log formats
const formats = {
    console: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
    ),
    file: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    )
};

// Create logger instance
const logger = winston.createLogger({
    level: config.logging.level,
    transports: [
        // Console transport
        new winston.transports.Console({
            format: formats.console
        }),
        // Error log file transport
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: formats.file,
            maxsize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
        }),
        // Combined log file transport
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            format: formats.file,
            maxsize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
        })
    ],
    // Handle uncaught exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            format: formats.file,
            maxsize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            format: formats.file,
            maxsize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
        })
    ]
});

// Create a write stream for Morgan access logs
logger.accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
);

// Add request logging method
logger.logRequest = (req, extra = {}) => {
    const logData = {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userId: req.session?.user?.id,
        userAgent: req.headers['user-agent'],
        ...extra
    };
    logger.info('Incoming request', logData);
};

// Add response logging method
logger.logResponse = (req, res, extra = {}) => {
    const logData = {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userId: req.session?.user?.id,
        statusCode: res.statusCode,
        responseTime: res.get('X-Response-Time'),
        ...extra
    };
    logger.info('Outgoing response', logData);
};

// Add error logging method
logger.logError = (error, req = null, extra = {}) => {
    const logData = {
        message: error.message,
        stack: error.stack,
        ...extra
    };

    if (req) {
        logData.method = req.method;
        logData.url = req.url;
        logData.ip = req.ip;
        logData.userId = req.session?.user?.id;
    }

    logger.error('Error occurred', logData);
};

// Add security logging method
logger.logSecurity = (event, req = null, extra = {}) => {
    const logData = {
        event,
        ...extra
    };

    if (req) {
        logData.method = req.method;
        logData.url = req.url;
        logData.ip = req.ip;
        logData.userId = req.session?.user?.id;
    }

    logger.warn('Security event', logData);
};

// Add audit logging method
logger.logAudit = (action, userId, details = {}) => {
    const logData = {
        action,
        userId,
        timestamp: new Date().toISOString(),
        ...details
    };

    logger.info('Audit log', logData);
};

// Add performance logging method
logger.logPerformance = (metric, value, extra = {}) => {
    const logData = {
        metric,
        value,
        timestamp: new Date().toISOString(),
        ...extra
    };

    logger.info('Performance metric', logData);
};

// Development only: Log to console when in development
if (config.environment !== 'production') {
    logger.debug('Logger initialized in development mode');
}

module.exports = logger;
