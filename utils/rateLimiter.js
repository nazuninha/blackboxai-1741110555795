const rateLimit = require('express-rate-limit');
const config = require('../config/config');
const logger = require('./logger');

// Create a store to track rate limit attempts
const attempts = new Map();

// Create a limiter for API endpoints
const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: config.rateLimit.message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const ip = req.ip;
        logger.logSecurity('Rate limit exceeded', req, {
            remainingTime: Math.ceil((attempts.get(ip)?.resetTime - Date.now()) / 1000)
        });
        res.status(429).json({
            error: config.rateLimit.message
        });
    },
    keyGenerator: (req) => req.ip,
    skip: (req) => req.path === '/health',  // Skip health check endpoint
    onLimitReached: (req) => {
        const ip = req.ip;
        attempts.set(ip, {
            count: 1,
            resetTime: Date.now() + config.rateLimit.windowMs
        });
        logger.warn('Rate limit reached', {
            ip,
            path: req.path,
            method: req.method
        });
    }
});

// Create a stricter limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const ip = req.ip;
        logger.logSecurity('Auth rate limit exceeded', req, {
            remainingTime: Math.ceil((attempts.get(ip)?.resetTime - Date.now()) / 1000)
        });
        res.status(429).json({
            error: 'Too many login attempts, please try again later'
        });
    },
    keyGenerator: (req) => req.ip,
    onLimitReached: (req) => {
        const ip = req.ip;
        attempts.set(ip, {
            count: 1,
            resetTime: Date.now() + (15 * 60 * 1000)
        });
        logger.warn('Auth rate limit reached', {
            ip,
            path: req.path,
            method: req.method
        });
    }
});

// Create a limiter for WhatsApp connection attempts
const whatsappLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 connection attempts per hour
    message: 'Too many connection attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const ip = req.ip;
        logger.logSecurity('WhatsApp connection rate limit exceeded', req, {
            remainingTime: Math.ceil((attempts.get(ip)?.resetTime - Date.now()) / 1000)
        });
        res.status(429).json({
            error: 'Too many connection attempts, please try again later'
        });
    },
    keyGenerator: (req) => req.ip,
    onLimitReached: (req) => {
        const ip = req.ip;
        attempts.set(ip, {
            count: 1,
            resetTime: Date.now() + (60 * 60 * 1000)
        });
        logger.warn('WhatsApp connection rate limit reached', {
            ip,
            path: req.path,
            method: req.method
        });
    }
});

// Helper function to check if an IP is currently rate limited
const isRateLimited = (ip) => {
    const attempt = attempts.get(ip);
    if (!attempt) return false;
    
    if (Date.now() > attempt.resetTime) {
        attempts.delete(ip);
        return false;
    }
    
    return true;
};

// Helper function to get remaining time until rate limit reset
const getRateLimitResetTime = (ip) => {
    const attempt = attempts.get(ip);
    if (!attempt) return 0;
    
    const remainingTime = attempt.resetTime - Date.now();
    return remainingTime > 0 ? Math.ceil(remainingTime / 1000) : 0;
};

// Clean up expired rate limit attempts periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, attempt] of attempts.entries()) {
        if (now > attempt.resetTime) {
            attempts.delete(ip);
        }
    }
}, 60000); // Clean up every minute

// Middleware to track rate limit attempts
const trackRateLimit = (req, res, next) => {
    const ip = req.ip;
    
    // Add rate limit headers
    res.on('finish', () => {
        const attempt = attempts.get(ip);
        if (attempt) {
            res.setHeader('X-RateLimit-Reset', Math.ceil(attempt.resetTime / 1000));
        }
    });
    
    next();
};

module.exports = {
    apiLimiter,
    authLimiter,
    whatsappLimiter,
    isRateLimited,
    getRateLimitResetTime,
    trackRateLimit
};
