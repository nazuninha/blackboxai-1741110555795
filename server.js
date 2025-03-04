const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const config = require('./config/config');
const logger = require('./utils/logger');
const botManager = require('./bot/botManager');

// Create Express app
const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
    store: new FileStore({
        path: config.paths.sessions,
        ttl: config.auth.sessionTimeout / 1000
    }),
    secret: config.auth.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: config.auth.sessionTimeout
    }
}));

// Security middleware
app.use((req, res, next) => {
    // CORS headers
    res.header('Access-Control-Allow-Origin', config.cors.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', true);

    // Security headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// Routes
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/', require('./routes/numbers'));
app.use('/', require('./routes/settings'));

// Error handling
app.use((req, res, next) => {
    res.status(404).render('error', {
        statusCode: 404,
        message: 'Page not found'
    });
});

app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);

    res.status(err.status || 500).render('error', {
        statusCode: err.status || 500,
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        error: process.env.NODE_ENV === 'production' ? {} : err
    });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
});

// Initialize bot manager
botManager.init().catch(err => {
    logger.error('Error initializing bot manager:', err);
    process.exit(1);
});

// Handle process termination
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    
    try {
        // Disconnect all bots
        await botManager.disconnectAll();
        
        // Close server
        server.close(() => {
            logger.info('Server closed');
            process.exit(0);
        });
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
