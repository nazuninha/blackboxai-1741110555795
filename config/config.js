const path = require('path');

// Load environment variables
require('dotenv').config();

const config = {
    // Environment
    env: process.env.NODE_ENV || 'development',
    
    // Server
    port: process.env.PORT || 3000,
    
    // Authentication
    auth: {
        sessionSecret: process.env.SESSION_SECRET || 'your-secret-key',
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours
        bcryptRounds: 10,
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
    },

    // CORS
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
    },

    // File paths
    paths: {
        data: path.join(__dirname, '../data'),
        logs: path.join(__dirname, '../logs'),
        sessions: path.join(__dirname, '../sessions'),
        get users() { return path.join(this.data, 'users.json') },
        get numbers() { return path.join(this.data, 'numbers.json') },
        get settings() { return path.join(this.data, 'settings.json') },
    },

    // Rate limiting
    rateLimit: {
        api: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
        },
        auth: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 5, // limit each IP to 5 login attempts per windowMs
        },
        whatsapp: {
            windowMs: 24 * 60 * 60 * 1000, // 24 hours
            max: 10, // limit each IP to 10 connection attempts per windowMs
        },
    },

    // WhatsApp bot defaults
    botDefaults: {
        autoReply: {
            enabled: false,
            message: "Thanks for your message! I'll get back to you soon.",
        },
        workingHours: {
            enabled: false,
            start: '09:00',
            end: '17:00',
            timezone: 'UTC',
            outOfHoursMessage: "I'm currently outside working hours. I'll respond when I'm back.",
        },
        responseDelay: {
            min: 1,  // seconds
            max: 5,  // seconds
        },
        messageTemplates: [
            {
                id: 'welcome',
                name: 'Welcome Message',
                trigger: '!welcome',
                content: 'Welcome! How can I help you today?',
            },
            {
                id: 'help',
                name: 'Help Message',
                trigger: '!help',
                content: 'Available commands:\n!welcome - Show welcome message\n!help - Show this help message',
            },
        ],
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: {
            enabled: true,
            filename: path.join(__dirname, '../logs/app.log'),
            maxSize: '10m',
            maxFiles: '7d',
        },
        audit: {
            enabled: true,
            filename: path.join(__dirname, '../logs/audit.log'),
        },
    },

    // Default admin user (created if no users exist)
    defaultAdmin: {
        name: 'Admin',
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role: 'admin',
    },

    // Initialize required directories
    init() {
        const fs = require('fs');
        const dirs = [this.paths.data, this.paths.logs, this.paths.sessions];
        
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        // Create default files if they don't exist
        const files = [
            { path: this.paths.users, content: { users: [] } },
            { path: this.paths.numbers, content: { numbers: [] } },
            { path: this.paths.settings, content: { settings: this.botDefaults } },
        ];

        for (const file of files) {
            if (!fs.existsSync(file.path)) {
                fs.writeFileSync(file.path, JSON.stringify(file.content, null, 2));
            }
        }
    },
};

// Initialize directories and files
config.init();

module.exports = config;
