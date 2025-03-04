const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const rateLimiter = require('../utils/rateLimiter');

// Apply rate limiter middleware to login route
router.post('/login', rateLimiter.middleware(), AuthController.login);

// Login page
router.get('/login', (req, res) => {
    // Redirect to dashboard if already logged in
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('login', {
        title: 'Login',
        error: req.query.error,
        success: req.query.success
    });
});

// Logout route
router.post('/logout', AuthController.isAuthenticated, AuthController.logout);

// Change password route
router.post('/change-password', 
    AuthController.isAuthenticated,
    AuthController.changePassword
);

// Password reset request page
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', {
        title: 'Forgot Password',
        error: req.query.error,
        success: req.query.success
    });
});

// Handle password reset request
router.post('/forgot-password', async (req, res) => {
    // This would typically send a reset email
    // For this implementation, we'll just show a success message
    res.json({
        success: true,
        message: 'If an account exists with this email, a reset link will be sent.'
    });
});

module.exports = router;
