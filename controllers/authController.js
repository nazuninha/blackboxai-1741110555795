const bcrypt = require('bcrypt');
const Database = require('../utils/database');
const logger = require('../utils/logger');
const rateLimiter = require('../utils/rateLimiter');
const config = require('../config/config');

class AuthController {
    /**
     * Initialize default admin user if none exists
     */
    static async initializeDefaultUser() {
        try {
            const data = await Database.read(config.paths.users);
            if (!data.users || data.users.length === 0) {
                // Create default admin user
                const hashedPassword = await bcrypt.hash('admin', 10);
                await Database.write(config.paths.users, {
                    users: [{
                        id: 1,
                        email: 'admin@admin.com',
                        password: hashedPassword,
                        role: 'admin',
                        createdAt: new Date().toISOString()
                    }]
                });
                logger.info('Default admin user created');
            }
        } catch (error) {
            logger.error('Error initializing default user:', error);
        }
    }

    /**
     * Handle user login
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const ip = req.ip;

            // Check rate limiting
            if (rateLimiter.isLocked(ip)) {
                const record = rateLimiter.attempts.get(ip);
                return res.status(429).json({
                    error: 'Too many failed attempts',
                    lockedUntil: new Date(record.lockedUntil).toISOString()
                });
            }

            // Validate input
            if (!email || !password) {
                return res.status(400).json({
                    error: 'Email and password are required'
                });
            }

            // Get user data
            const data = await Database.read(config.paths.users);
            const user = data.users.find(u => u.email === email);

            // Check if user exists and verify password
            if (user && await bcrypt.compare(password, user.password)) {
                // Reset failed attempts on successful login
                rateLimiter.resetAttempts(ip);

                // Set session
                req.session.user = {
                    id: user.id,
                    email: user.email,
                    role: user.role
                };

                // Log successful login
                logger.security('Successful login', {
                    userId: user.id,
                    email: user.email,
                    ip: ip
                });

                return res.json({
                    success: true,
                    redirect: '/dashboard'
                });
            }

            // Record failed attempt
            const attemptStatus = rateLimiter.recordFailedAttempt(ip);

            // Log failed login
            logger.security('Failed login attempt', {
                email,
                ip,
                remainingAttempts: attemptStatus.remaining
            });

            return res.status(401).json({
                error: 'Invalid email or password',
                remainingAttempts: attemptStatus.remaining
            });

        } catch (error) {
            logger.error('Login error:', error);
            return res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    /**
     * Handle user logout
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async logout(req, res) {
        try {
            const userId = req.session.user?.id;
            
            // Destroy session
            req.session.destroy(err => {
                if (err) {
                    logger.error('Error destroying session:', err);
                    return res.status(500).json({
                        error: 'Error logging out'
                    });
                }

                // Log successful logout
                if (userId) {
                    logger.security('User logged out', {
                        userId,
                        ip: req.ip
                    });
                }

                res.clearCookie('connect.sid');
                res.json({
                    success: true,
                    redirect: '/login'
                });
            });
        } catch (error) {
            logger.error('Logout error:', error);
            return res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    /**
     * Change user password
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.session.user?.id;

            if (!userId) {
                return res.status(401).json({
                    error: 'Unauthorized'
                });
            }

            // Validate input
            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    error: 'Current password and new password are required'
                });
            }

            // Get user data
            const data = await Database.read(config.paths.users);
            const user = data.users.find(u => u.id === userId);

            // Verify current password
            if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
                return res.status(401).json({
                    error: 'Current password is incorrect'
                });
            }

            // Update password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedPassword;
            await Database.write(config.paths.users, {
                users: data.users.map(u => u.id === userId ? user : u)
            });

            // Log password change
            logger.security('Password changed', {
                userId,
                ip: req.ip
            });

            return res.json({
                success: true,
                message: 'Password updated successfully'
            });

        } catch (error) {
            logger.error('Change password error:', error);
            return res.status(500).json({
                error: 'Internal server error'
            });
        }
    }

    /**
     * Middleware to check if user is authenticated
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    static isAuthenticated(req, res, next) {
        if (req.session.user) {
            return next();
        }
        
        // If AJAX request
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(401).json({
                error: 'Unauthorized',
                redirect: '/login'
            });
        }

        // Regular request
        res.redirect('/login');
    }

    /**
     * Middleware to check if user is admin
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    static isAdmin(req, res, next) {
        if (req.session.user?.role === 'admin') {
            return next();
        }

        return res.status(403).json({
            error: 'Forbidden'
        });
    }
}

// Initialize default user when module is loaded
AuthController.initializeDefaultUser();

module.exports = AuthController;
