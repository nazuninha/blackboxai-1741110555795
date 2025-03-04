const bcrypt = require('bcryptjs');
const config = require('../config/config');
const Database = require('../utils/database');
const logger = require('../utils/logger');
const { trackAttempt, resetAttempts } = require('../utils/rateLimiter');

class AuthController {
    /**
     * Check if user is authenticated
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    static isAuthenticated(req, res, next) {
        if (req.session.user) {
            return next();
        }
        
        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }

        res.redirect('/login');
    }

    /**
     * Check if user is admin
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    static isAdmin(req, res, next) {
        if (req.session.user?.role === 'admin') {
            return next();
        }

        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(403).json({
                error: 'Admin access required'
            });
        }

        res.status(403).render('error', {
            message: 'Admin access required'
        });
    }

    /**
     * Render login page
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static renderLogin(req, res) {
        if (req.session.user) {
            return res.redirect('/dashboard');
        }
        res.render('login');
    }

    /**
     * Handle login
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            // Check for lockout
            const isLocked = trackAttempt(
                `login:${email}`,
                config.auth.maxLoginAttempts,
                config.auth.lockoutDuration
            );

            if (isLocked) {
                logger.logSecurity('Login attempt during lockout', req, { email });
                return res.status(429).json({
                    error: 'Account is temporarily locked. Please try again later.'
                });
            }

            // Get user from database
            const data = await Database.read(config.paths.users);
            const user = (data.users || []).find(u => u.email === email);

            if (!user || !(await bcrypt.compare(password, user.password))) {
                logger.logSecurity('Failed login attempt', req, { email });
                return res.status(401).json({
                    error: 'Invalid email or password'
                });
            }

            // Reset failed attempts on successful login
            resetAttempts(`login:${email}`);

            // Create session
            req.session.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            };

            logger.logAudit('User logged in', user.id);

            res.json({
                success: true,
                redirect: '/dashboard'
            });
        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({
                error: 'Error processing login'
            });
        }
    }

    /**
     * Handle logout
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async logout(req, res) {
        if (req.session.user) {
            const userId = req.session.user.id;
            req.session.destroy(() => {
                logger.logAudit('User logged out', userId);
                res.redirect('/login');
            });
        } else {
            res.redirect('/login');
        }
    }

    /**
     * Render forgot password page
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static renderForgotPassword(req, res) {
        res.render('forgot-password');
    }

    /**
     * Handle forgot password request
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            // Get user from database
            const data = await Database.read(config.paths.users);
            const user = (data.users || []).find(u => u.email === email);

            if (!user) {
                // Return success even if user not found (security)
                return res.json({
                    success: true,
                    message: 'If your email is registered, you will receive reset instructions.'
                });
            }

            // Generate reset token
            const token = crypto.randomBytes(32).toString('hex');
            const expires = Date.now() + 3600000; // 1 hour

            // Save token to user
            await Database.updateInArray(
                config.paths.users,
                'users',
                u => u.id === user.id,
                {
                    resetToken: token,
                    resetExpires: expires
                }
            );

            // TODO: Send reset email
            logger.logAudit('Password reset requested', user.id);

            res.json({
                success: true,
                message: 'If your email is registered, you will receive reset instructions.'
            });
        } catch (error) {
            logger.error('Forgot password error:', error);
            res.status(500).json({
                error: 'Error processing request'
            });
        }
    }

    /**
     * Render reset password page
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async renderResetPassword(req, res) {
        try {
            const { token } = req.params;

            // Get user from database
            const data = await Database.read(config.paths.users);
            const user = (data.users || []).find(u => 
                u.resetToken === token && 
                u.resetExpires > Date.now()
            );

            if (!user) {
                return res.render('error', {
                    message: 'Invalid or expired reset token'
                });
            }

            res.render('reset-password', { token });
        } catch (error) {
            logger.error('Reset password error:', error);
            res.render('error', {
                message: 'Error processing request'
            });
        }
    }

    /**
     * Handle reset password
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async resetPassword(req, res) {
        try {
            const { token } = req.params;
            const { password } = req.body;

            // Get user from database
            const data = await Database.read(config.paths.users);
            const user = (data.users || []).find(u => 
                u.resetToken === token && 
                u.resetExpires > Date.now()
            );

            if (!user) {
                return res.status(400).json({
                    error: 'Invalid or expired reset token'
                });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(password, config.auth.bcryptRounds);

            // Update user
            await Database.updateInArray(
                config.paths.users,
                'users',
                u => u.id === user.id,
                {
                    password: hashedPassword,
                    resetToken: null,
                    resetExpires: null
                }
            );

            logger.logAudit('Password reset completed', user.id);

            res.json({
                success: true,
                message: 'Password has been reset successfully'
            });
        } catch (error) {
            logger.error('Reset password error:', error);
            res.status(500).json({
                error: 'Error processing request'
            });
        }
    }

    /**
     * Initialize default admin user if no users exist
     */
    static async initDefaultAdmin() {
        try {
            const data = await Database.read(config.paths.users);
            if (!data.users || data.users.length === 0) {
                const hashedPassword = await bcrypt.hash(
                    config.defaultAdmin.password,
                    config.auth.bcryptRounds
                );

                await Database.write(config.paths.users, {
                    users: [{
                        id: 'admin',
                        ...config.defaultAdmin,
                        password: hashedPassword,
                        createdAt: new Date().toISOString()
                    }]
                });

                logger.logSystem('Default admin user created');
            }
        } catch (error) {
            logger.error('Error initializing default admin:', error);
            throw error;
        }
    }
}

// Initialize default admin user
AuthController.initDefaultAdmin().catch(console.error);

module.exports = AuthController;
