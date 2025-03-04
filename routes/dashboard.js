const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const AuthController = require('../controllers/authController');
const { apiLimiter } = require('../utils/rateLimiter');

// Apply authentication middleware to all routes
router.use(AuthController.isAuthenticated);

// Apply rate limiting to API endpoints
router.use('/api', apiLimiter);

// Dashboard page
router.get('/dashboard', DashboardController.renderDashboard);
router.get('/', (req, res) => res.redirect('/dashboard'));

// Metrics endpoints
router.get('/api/metrics/message-volume', DashboardController.getMessageVolume);
router.get('/api/metrics/response-time', DashboardController.getResponseTime);

// Real-time updates endpoint
router.get('/api/updates', DashboardController.getUpdates);

// Export router
module.exports = router;
