const config = require('../config/config');
const Database = require('../utils/database');
const logger = require('../utils/logger');
const botManager = require('../bot/botManager');

class DashboardController {
    /**
     * Render dashboard page
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async renderDashboard(req, res) {
        try {
            // Get numbers data
            const numbersData = await Database.read(config.paths.numbers);
            const numbers = numbersData.numbers || [];

            // Get active connections
            const connections = botManager.getConnections();

            // Calculate stats
            const stats = {
                total: numbers.length,
                active: connections.length,
                messagesReceived: numbers.reduce((sum, n) => sum + (n.stats?.received || 0), 0),
                messagesSent: numbers.reduce((sum, n) => sum + (n.stats?.sent || 0), 0)
            };

            // Get recent activity
            const activity = await DashboardController.getRecentActivity();

            // Map connection status to numbers
            const numbersWithStatus = numbers.map(number => ({
                ...number,
                isConnected: connections.includes(number.id),
                qrCode: botManager.getQRCode(number.id)
            }));

            res.render('dashboard', {
                user: req.session.user,
                numbers: numbersWithStatus,
                stats,
                activity,
                path: '/dashboard'
            });
        } catch (error) {
            logger.error('Error rendering dashboard:', error);
            res.render('error', {
                message: 'Error loading dashboard'
            });
        }
    }

    /**
     * Get metrics for message volume
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getMessageVolume(req, res) {
        try {
            const numbersData = await Database.read(config.paths.numbers);
            const numbers = numbersData.numbers || [];

            // Calculate hourly message volume for the last 24 hours
            const now = new Date();
            const hourlyData = Array(24).fill(0);

            numbers.forEach(number => {
                const messages = number.messages || [];
                messages.forEach(msg => {
                    const msgDate = new Date(msg.timestamp);
                    if (now - msgDate <= 24 * 60 * 60 * 1000) { // Last 24 hours
                        const hourIndex = 23 - Math.floor((now - msgDate) / (60 * 60 * 1000));
                        if (hourIndex >= 0) {
                            hourlyData[hourIndex]++;
                        }
                    }
                });
            });

            res.json({
                success: true,
                hourly: hourlyData
            });
        } catch (error) {
            logger.error('Error getting message volume:', error);
            res.status(500).json({
                error: 'Error getting message volume data'
            });
        }
    }

    /**
     * Get metrics for response time
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getResponseTime(req, res) {
        try {
            const numbersData = await Database.read(config.paths.numbers);
            const numbers = numbersData.numbers || [];

            // Calculate average response times for the last 24 hours
            const now = new Date();
            const data = [];

            numbers.forEach(number => {
                const messages = number.messages || [];
                messages.forEach(msg => {
                    if (msg.responseTime && now - new Date(msg.timestamp) <= 24 * 60 * 60 * 1000) {
                        data.push([
                            new Date(msg.timestamp).getTime(),
                            msg.responseTime
                        ]);
                    }
                });
            });

            // Sort by timestamp
            data.sort((a, b) => a[0] - b[0]);

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error getting response time:', error);
            res.status(500).json({
                error: 'Error getting response time data'
            });
        }
    }

    /**
     * Get recent activity
     * @returns {Promise<Array>} Recent activity items
     */
    static async getRecentActivity() {
        try {
            // Read audit log
            const auditLog = await Database.read(config.logging.audit.filename);
            const entries = auditLog.entries || [];

            // Get last 10 relevant entries
            return entries
                .filter(entry => {
                    // Filter relevant activity types
                    const relevantTypes = ['whatsapp', 'number', 'message'];
                    return relevantTypes.includes(entry.type);
                })
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10)
                .map(entry => ({
                    id: entry.id,
                    type: entry.level === 'error' ? 'error' :
                          entry.level === 'warn' ? 'warning' :
                          entry.type === 'whatsapp' ? 'info' : 'success',
                    message: entry.message,
                    timestamp: entry.timestamp
                }));
        } catch (error) {
            logger.error('Error getting recent activity:', error);
            return [];
        }
    }

    /**
     * Get real-time updates
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getUpdates(req, res) {
        try {
            // Set headers for SSE
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            // Send initial data
            const initialData = await DashboardController.getCurrentState();
            res.write(`data: ${JSON.stringify(initialData)}\n\n`);

            // Set up event listeners
            const updateClient = async (type, data) => {
                res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
            };

            // Listen for various events
            botManager.on('connection', (numberId) => {
                updateClient('connection', { numberId, status: 'connected' });
            });

            botManager.on('disconnection', (numberId) => {
                updateClient('connection', { numberId, status: 'disconnected' });
            });

            botManager.on('message', async () => {
                const stats = await DashboardController.getCurrentStats();
                updateClient('stats', stats);
            });

            // Clean up on client disconnect
            req.on('close', () => {
                botManager.removeAllListeners();
            });
        } catch (error) {
            logger.error('Error setting up updates:', error);
            res.status(500).json({
                error: 'Error setting up real-time updates'
            });
        }
    }

    /**
     * Get current system state
     * @returns {Promise<Object>} Current state
     */
    static async getCurrentState() {
        const [stats, activity] = await Promise.all([
            DashboardController.getCurrentStats(),
            DashboardController.getRecentActivity()
        ]);

        return {
            stats,
            activity
        };
    }

    /**
     * Get current statistics
     * @returns {Promise<Object>} Current statistics
     */
    static async getCurrentStats() {
        const numbersData = await Database.read(config.paths.numbers);
        const numbers = numbersData.numbers || [];
        const connections = botManager.getConnections();

        return {
            total: numbers.length,
            active: connections.length,
            messagesReceived: numbers.reduce((sum, n) => sum + (n.stats?.received || 0), 0),
            messagesSent: numbers.reduce((sum, n) => sum + (n.stats?.sent || 0), 0)
        };
    }
}

module.exports = DashboardController;
