const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const config = require('./config/config');
const logger = require('./utils/logger');
const botManager = require('./bot/botManager');

// Initialize express app
const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https:", "http:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    }
}));

// Logging middleware
app.use(morgan('combined', { stream: logger.accessLogStream }));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session middleware
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.environment === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize data files if they don't exist
const fs = require('fs');
const dataFiles = [
    { path: config.paths.users, default: { users: [] } },
    { path: config.paths.settings, default: { settings: config.botDefaults } },
    { path: config.paths.numbers, default: { numbers: [] } },
    { path: config.paths.menus, default: { menus: [] } }
];

dataFiles.forEach(file => {
    if (!fs.existsSync(file.path)) {
        const dir = path.dirname(file.path);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(file.path, JSON.stringify(file.default, null, 2));
    }
});

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Mount routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const numbersRoutes = require('./routes/numbers');
const settingsRoutes = require('./routes/settings');

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(numbersRoutes);
app.use(settingsRoutes);

// Root route redirect to login/dashboard
app.get('/', (req, res) => {
    res.redirect(req.session.user ? '/dashboard' : '/login');
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Not Found',
        message: 'The page you are looking for does not exist.',
        error: {
            status: 404
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    
    res.status(err.status || 500).render('error', {
        title: 'Error',
        message: config.environment === 'development' ? err.message : 'Internal Server Error',
        error: config.environment === 'development' ? err : {}
    });
});

// Initialize bot manager
botManager.init().catch(err => {
    logger.error('Error initializing bot manager:', err);
});

// Start server
const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
    logger.info(`Environment: ${config.environment}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed. Exiting process.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed. Exiting process.');
        process.exit(0);
    });
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
