const config = require('../config/config');
const Database = require('../utils/database');
const logger = require('../utils/logger');
const botManager = require('../bot/botManager');

class NumbersController {
    /**
     * Render numbers page
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async renderNumbers(req, res) {
        try {
            // Get numbers data
            const data = await Database.read(config.paths.numbers);
            const numbers = data.numbers || [];

            // Get active connections
            const connections = await botManager.getConnections();

            // Map connection status to numbers
            const numbersWithStatus = numbers.map(number => ({
                ...number,
                isConnected: connections.some(conn => conn.id === number.id),
                qrCode: botManager.getQRCode(number.id)
            }));

            res.render('numbers', {
                user: req.session.user,
                numbers: numbersWithStatus,
                path: '/numbers'
            });
        } catch (error) {
            logger.error('Error rendering numbers page:', error);
            res.render('error', {
                message: 'Error loading WhatsApp numbers'
            });
        }
    }

    /**
     * Add a new WhatsApp number
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async addNumber(req, res) {
        try {
            const { phoneNumber, name, description } = req.body;

            // Validate phone number
            if (!phoneNumber.match(/^\+?[\d\s-]+$/)) {
                return res.status(400).json({
                    error: 'Invalid phone number format'
                });
            }

            // Generate unique ID
            const id = `whatsapp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Create number object
            const number = {
                id,
                phoneNumber,
                name: name || phoneNumber,
                description: description || '',
                createdAt: new Date().toISOString(),
                createdBy: req.session.user.id,
                status: 'disconnected',
                stats: {
                    received: 0,
                    sent: 0,
                    errors: 0
                }
            };

            // Add to database
            await Database.addToArray(config.paths.numbers, 'numbers', number);

            logger.logAudit('Number added', req.session.user.id, {
                numberId: id,
                phoneNumber
            });

            res.json({
                success: true,
                number
            });
        } catch (error) {
            logger.error('Error adding number:', error);
            res.status(500).json({
                error: 'Error adding WhatsApp number'
            });
        }
    }

    /**
     * Update a WhatsApp number
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async updateNumber(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated directly
            delete updates.id;
            delete updates.createdAt;
            delete updates.createdBy;
            delete updates.stats;

            // Update in database
            await Database.updateInArray(
                config.paths.numbers,
                'numbers',
                number => number.id === id,
                {
                    ...updates,
                    updatedAt: new Date().toISOString(),
                    updatedBy: req.session.user.id
                }
            );

            logger.logAudit('Number updated', req.session.user.id, {
                numberId: id,
                updates
            });

            res.json({
                success: true,
                message: 'Number updated successfully'
            });
        } catch (error) {
            logger.error('Error updating number:', error);
            res.status(500).json({
                error: 'Error updating WhatsApp number'
            });
        }
    }

    /**
     * Delete a WhatsApp number
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async deleteNumber(req, res) {
        try {
            const { id } = req.params;

            // Disconnect if connected
            if (botManager.connections.has(id)) {
                await botManager.disconnect(id);
            }

            // Remove from database
            await Database.removeFromArray(
                config.paths.numbers,
                'numbers',
                number => number.id === id
            );

            logger.logAudit('Number deleted', req.session.user.id, {
                numberId: id
            });

            res.json({
                success: true,
                message: 'Number deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting number:', error);
            res.status(500).json({
                error: 'Error deleting WhatsApp number'
            });
        }
    }

    /**
     * Connect a WhatsApp number
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async connectNumber(req, res) {
        try {
            const { id } = req.params;

            // Check if already connected
            if (botManager.connections.has(id)) {
                return res.status(400).json({
                    error: 'Number is already connected'
                });
            }

            // Start connection
            await botManager.connect(id);

            logger.logAudit('Number connection initiated', req.session.user.id, {
                numberId: id
            });

            res.json({
                success: true,
                message: 'Connection initiated'
            });
        } catch (error) {
            logger.error('Error connecting number:', error);
            res.status(500).json({
                error: 'Error connecting WhatsApp number'
            });
        }
    }

    /**
     * Disconnect a WhatsApp number
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async disconnectNumber(req, res) {
        try {
            const { id } = req.params;

            // Check if connected
            if (!botManager.connections.has(id)) {
                return res.status(400).json({
                    error: 'Number is not connected'
                });
            }

            // Disconnect
            await botManager.disconnect(id);

            logger.logAudit('Number disconnected', req.session.user.id, {
                numberId: id
            });

            res.json({
                success: true,
                message: 'Number disconnected successfully'
            });
        } catch (error) {
            logger.error('Error disconnecting number:', error);
            res.status(500).json({
                error: 'Error disconnecting WhatsApp number'
            });
        }
    }

    /**
     * Get QR code for a number
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getQRCode(req, res) {
        try {
            const { id } = req.params;
            const qrCode = botManager.getQRCode(id);

            if (!qrCode) {
                return res.status(404).json({
                    error: 'QR code not available'
                });
            }

            res.json({
                success: true,
                qrCode
            });
        } catch (error) {
            logger.error('Error getting QR code:', error);
            res.status(500).json({
                error: 'Error getting QR code'
            });
        }
    }

    /**
     * Get number statistics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getStats(req, res) {
        try {
            const { id } = req.params;

            // Get number from database
            const data = await Database.read(config.paths.numbers);
            const number = (data.numbers || []).find(n => n.id === id);

            if (!number) {
                return res.status(404).json({
                    error: 'Number not found'
                });
            }

            res.json({
                success: true,
                stats: number.stats || {}
            });
        } catch (error) {
            logger.error('Error getting number stats:', error);
            res.status(500).json({
                error: 'Error getting number statistics'
            });
        }
    }
}

module.exports = NumbersController;
