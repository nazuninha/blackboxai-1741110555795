const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const AuthController = require('../controllers/authController');

// Apply authentication middleware to all dashboard routes
router.use(AuthController.isAuthenticated);

// Main dashboard page
router.get('/dashboard', DashboardController.renderDashboard);

// API endpoints for dashboard data
router.get('/api/dashboard/data', DashboardController.getDashboardData);

// Real-time updates endpoint
router.get('/api/dashboard/updates', DashboardController.getRealTimeUpdates);

// System status endpoint
router.get('/api/dashboard/status', async (req, res) => {
    try {
        const status = {
            uptime: process.uptime(),
            timestamp: Date.now(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
        };
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching system status' });
    }
});

// Export metrics endpoint (Admin only)
router.get('/api/dashboard/export', 
    AuthController.isAdmin,
    async (req, res) => {
        try {
            const data = await DashboardController.getDashboardData(req, res);
            res.attachment('dashboard-metrics.json');
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Error exporting metrics' });
        }
    }
);

module.exports = router;
