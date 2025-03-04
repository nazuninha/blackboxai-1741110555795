const Database = require('../utils/database');
const logger = require('../utils/logger');
const config = require('../config/config');
const botManager = require('../bot/botManager');

class DashboardController {
    /**
     * Get dashboard metrics and data
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getDashboardData(req, res) {
        try {
            // Get connected numbers
            const numbersData = await Database.read(config.paths.numbers);
            const numbers = numbersData.numbers || [];

            // Get bot settings
            const settingsData = await Database.read(config.paths.settings);
            const settings = settingsData.settings || {};

            // Get active connections from bot manager
            const activeConnections = await botManager.getConnections();

            // Calculate metrics
            const metrics = {
                totalNumbers: numbers.length,
                activeNumbers: activeConnections.filter(conn => conn.status === 'connected').length,
                messagesToday: await this.getMessageCountForToday(),
                responseRate: await this.calculateResponseRate(),
                uptime: process.uptime(),
                lastError: await this.getLastError()
            };

            // Get historical data for charts
            const chartData = await this.getChartData();

            return res.json({
                success: true,
                data: {
                    metrics,
                    numbers,
                    settings,
                    chartData
                }
            });
        } catch (error) {
            logger.error('Error getting dashboard data:', error);
            return res.status(500).json({
                error: 'Error fetching dashboard data'
            });
        }
    }

    /**
     * Get message count for today
     * @returns {Promise<number>}
     */
    static async getMessageCountForToday() {
        try {
            // This would typically query a message log or database
            // For now, return a mock value
            return Math.floor(Math.random() * 1000);
        } catch (error) {
            logger.error('Error getting message count:', error);
            return 0;
        }
    }

    /**
     * Calculate response rate
     * @returns {Promise<number>}
     */
    static async calculateResponseRate() {
        try {
            // This would typically calculate based on actual message logs
            // For now, return a mock value between 90-100%
            return 90 + Math.floor(Math.random() * 10);
        } catch (error) {
            logger.error('Error calculating response rate:', error);
            return 0;
        }
    }

    /**
     * Get last error from logs
     * @returns {Promise<Object|null>}
     */
    static async getLastError() {
        try {
            // This would typically get the last error from the error log
            // For now, return null (no errors)
            return null;
        } catch (error) {
            logger.error('Error getting last error:', error);
            return null;
        }
    }

    /**
     * Get chart data for dashboard graphs
     * @returns {Promise<Object>}
     */
    static async getChartData() {
        try {
            // Generate mock data for charts
            const today = new Date();
            const labels = Array.from({ length: 7 }, (_, i) => {
                const date = new Date(today);
                date.setDate(date.getDate() - (6 - i));
                return date.toLocaleDateString('en-US', { weekday: 'short' });
            });

            return {
                messageHistory: {
                    labels,
                    datasets: [{
                        label: 'Messages Sent',
                        data: Array.from({ length: 7 }, () => Math.floor(Math.random() * 1000)),
                        borderColor: '#10B981',
                        tension: 0.4
                    }]
                },
                responseTime: {
                    labels,
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: Array.from({ length: 7 }, () => Math.floor(Math.random() * 1000) + 500),
                        borderColor: '#3B82F6',
                        tension: 0.4
                    }]
                },
                activeUsers: {
                    labels,
                    datasets: [{
                        label: 'Active Users',
                        data: Array.from({ length: 7 }, () => Math.floor(Math.random() * 100)),
                        borderColor: '#8B5CF6',
                        tension: 0.4
                    }]
                }
            };
        } catch (error) {
            logger.error('Error generating chart data:', error);
            return {};
        }
    }

    /**
     * Render dashboard page
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async renderDashboard(req, res) {
        try {
            res.render('dashboard', {
                title: 'Dashboard',
                user: req.session.user
            });
        } catch (error) {
            logger.error('Error rendering dashboard:', error);
            res.status(500).render('error', {
                message: 'Error loading dashboard'
            });
        }
    }

    /**
     * Get real-time updates for dashboard
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getRealTimeUpdates(req, res) {
        try {
            const updates = {
                activeConnections: await botManager.getConnections(),
                messageCount: await this.getMessageCountForToday(),
                responseRate: await this.calculateResponseRate(),
                timestamp: new Date().toISOString()
            };

            return res.json({
                success: true,
                data: updates
            });
        } catch (error) {
            logger.error('Error getting real-time updates:', error);
            return res.status(500).json({
                error: 'Error fetching real-time updates'
            });
        }
    }
}

module.exports = DashboardController;
