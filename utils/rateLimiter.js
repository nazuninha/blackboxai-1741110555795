const rateLimit = require('express-rate-limit');
const config = require('../config/config');
const logger = require('./logger');

// Helper function to create a limiter with custom options
const createLimiter = (options) => {
    return rateLimit({
        windowMs: options.windowMs,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.logSecurity('Rate limit exceeded', req, {
                limit: options.max,
                windowMs: options.windowMs
            });
            
            res.status(429).json({
                error: 'Too many requests, please try again later.'
            });
        },
        skip: (req) => {
            // Skip rate limiting for local development
            return process.env.NODE_ENV === 'development' && req.ip === '::1';
        },
        keyGenerator: (req) => {
            // Use X-Forwarded-For header if available (for proxy support)
            return req.headers['x-forwarded-for'] || req.ip;
        }
    });
};

// API rate limiter
const apiLimiter = createLimiter(config.rateLimit.api);

// Authentication rate limiter
const authLimiter = createLimiter(config.rateLimit.auth);

// WhatsApp connection rate limiter
const whatsappLimiter = createLimiter(config.rateLimit.whatsapp);

// Dynamic rate limiter for specific routes
const createDynamicLimiter = (windowMs, max) => {
    return createLimiter({
        windowMs: windowMs,
        max: max
    });
};

// Store for tracking failed attempts (e.g., login attempts)
const attemptStore = new Map();

// Helper to track failed attempts
const trackAttempt = (key, maxAttempts, windowMs) => {
    const now = Date.now();
    const attempts = attemptStore.get(key) || { count: 0, firstAttempt: now };

    // Reset if window has expired
    if (now - attempts.firstAttempt > windowMs) {
        attempts.count = 1;
        attempts.firstAttempt = now;
    } else {
        attempts.count++;
    }

    attemptStore.set(key, attempts);
    return attempts.count >= maxAttempts;
};

// Helper to reset attempts
const resetAttempts = (key) => {
    attemptStore.delete(key);
};

// Clean up expired attempts periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of attemptStore.entries()) {
        if (now - value.firstAttempt > config.rateLimit.auth.windowMs) {
            attemptStore.delete(key);
        }
    }
}, 60000); // Clean up every minute

module.exports = {
    apiLimiter,
    authLimiter,
    whatsappLimiter,
    createDynamicLimiter,
    trackAttempt,
    resetAttempts
};
