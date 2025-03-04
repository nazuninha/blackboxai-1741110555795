const winston = require('winston');
const path = require('path');
const config = require('../config/config');

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
        let msg = `${timestamp} ${level}: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += `\n${JSON.stringify(meta, null, 2)}`;
        }
        return msg;
    })
);

// Custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: config.logging.level,
    format: fileFormat,
    transports: []
});

// Add console transport in non-production environments
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// Add file transport if enabled
if (config.logging.file.enabled) {
    logger.add(new winston.transports.File({
        filename: config.logging.file.filename,
        maxsize: config.logging.file.maxSize,
        maxFiles: config.logging.file.maxFiles,
        tailable: true
    }));
}

// Add audit log transport if enabled
if (config.logging.audit.enabled) {
    logger.add(new winston.transports.File({
        filename: config.logging.audit.filename,
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        )
    }));
}

// Add error log transport
logger.add(new winston.transports.File({
    filename: path.join(path.dirname(config.logging.file.filename), 'error.log'),
    level: 'error'
}));

// Extend logger with custom methods
const extendedLogger = {
    ...logger,

    /**
     * Log security-related events
     * @param {string} message - Log message
     * @param {Object} req - Express request object
     * @param {Object} meta - Additional metadata
     */
    logSecurity(message, req, meta = {}) {
        this.warn(message, {
            type: 'security',
            ip: req.ip,
            method: req.method,
            path: req.path,
            ...meta
        });
    },

    /**
     * Log audit events
     * @param {string} action - Action performed
     * @param {string} userId - ID of user performing action
     * @param {Object} meta - Additional metadata
     */
    logAudit(action, userId, meta = {}) {
        this.info(action, {
            type: 'audit',
            userId,
            timestamp: new Date().toISOString(),
            ...meta
        });
    },

    /**
     * Log API requests
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {number} duration - Request duration in milliseconds
     */
    logRequest(req, res, duration) {
        this.info('API Request', {
            type: 'request',
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            ip: req.ip
        });
    },

    /**
     * Log WhatsApp events
     * @param {string} event - Event name
     * @param {string} numberId - WhatsApp number ID
     * @param {Object} meta - Additional metadata
     */
    logWhatsApp(event, numberId, meta = {}) {
        this.info(event, {
            type: 'whatsapp',
            numberId,
            ...meta
        });
    },

    /**
     * Log performance metrics
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     * @param {Object} meta - Additional metadata
     */
    logMetric(metric, value, meta = {}) {
        this.info(metric, {
            type: 'metric',
            value,
            ...meta
        });
    },

    /**
     * Log system events
     * @param {string} event - Event name
     * @param {Object} meta - Additional metadata
     */
    logSystem(event, meta = {}) {
        this.info(event, {
            type: 'system',
            ...meta
        });
    }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    extendedLogger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    extendedLogger.error('Unhandled Rejection:', { reason, promise });
    process.exit(1);
});

module.exports = extendedLogger;
