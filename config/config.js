require('dotenv').config();
const path = require('path');

const config = {
    // Environment
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    sessionSecret: process.env.SESSION_SECRET || 'default-secret-key',

    // Paths
    paths: {
        data: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
        logs: process.env.LOG_DIR || path.join(__dirname, '..', 'logs'),
        users: path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'users.json'),
        settings: path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'settings.json'),
        numbers: path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'numbers.json'),
        menus: path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'menus.json')
    },

    // Bot Configuration
    botDefaults: {
        name: process.env.BOT_NAME || 'WhatsApp Bot',
        description: process.env.BOT_DESCRIPTION || 'A WhatsApp bot for managing multiple numbers',
        responseDelay: {
            min: parseInt(process.env.DEFAULT_RESPONSE_DELAY_MIN, 10) || 1000,
            max: parseInt(process.env.DEFAULT_RESPONSE_DELAY_MAX, 10) || 3000
        },
        autoRead: true,
        autoReply: true,
        workingHours: {
            enabled: false,
            start: '09:00',
            end: '17:00',
            timezone: 'UTC'
        },
        messageTemplates: [],
        absenceMessage: 'We are currently outside working hours. We will get back to you as soon as possible.',
        inactivityTimeout: parseInt(process.env.DEFAULT_INACTIVITY_TIMEOUT, 10) || 3600
    },

    // Security
    auth: {
        bcryptRounds: 10,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000 // 15 minutes
    },

    // Rate Limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.'
    },

    // Logging
    logging: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        maxFiles: 5,
        maxSize: '10m'
    },

    // WhatsApp Connection
    whatsapp: {
        reconnectInterval: 10000, // 10 seconds
        maxReconnectAttempts: 5,
        qrCodeTimeout: 60000, // 1 minute
        defaultPresence: 'available',
        markMessagesRead: true
    },

    // Development Settings
    development: {
        enableDebugLogs: true,
        mockWhatsAppConnection: false
    },

    // Production Settings
    production: {
        enableDebugLogs: false,
        trustProxy: true
    }
};

// Environment-specific overrides
if (config.environment === 'production') {
    Object.assign(config, config.production);
} else {
    Object.assign(config, config.development);
}

// Delete environment-specific configs from final export
delete config.development;
delete config.production;

module.exports = config;
