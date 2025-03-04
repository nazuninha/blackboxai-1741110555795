const Database = require('../utils/database');
const logger = require('../utils/logger');
const config = require('../config/config');
const botManager = require('../bot/botManager');

class NumbersController {
    /**
     * Get all WhatsApp numbers
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getNumbers(req, res) {
        try {
            const data = await Database.read(config.paths.numbers);
            const numbers = data.numbers || [];
            
            // Get real-time status for each number
            const activeConnections = await botManager.getConnections();
            const numbersWithStatus = numbers.map(number => ({
                ...number,
                status: activeConnections.find(conn => conn.id === number.id)?.status || 'disconnected'
            }));

            return res.json({
                success: true,
                data: numbersWithStatus
            });
        } catch (error) {
            logger.error('Error getting numbers:', error);
            return res.status(500).json({
                error: 'Error fetching numbers'
            });
        }
    }

    /**
     * Start QR code connection process
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async connectWithQR(req, res) {
        try {
            const sessionId = `session_${Date.now()}`;
            const qrCode = await botManager.connectWithQR(sessionId);

            return res.json({
                success: true,
                data: {
                    sessionId,
                    qrCode
                }
            });
        } catch (error) {
            logger.error('Error starting QR connection:', error);
            return res.status(500).json({
                error: 'Error generating QR code'
            });
        }
    }

    /**
     * Start phone number connection process
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async connectWithPhone(req, res) {
        try {
            const { phoneNumber } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({
                    error: 'Phone number is required'
                });
            }

            // Validate phone number format
            const phoneNumberRegex = /^\+[1-9]\d{1,14}$/;
            if (!phoneNumberRegex.test(phoneNumber)) {
                return res.status(400).json({
                    error: 'Invalid phone number format. Use international format (e.g., +1234567890)'
                });
            }

            const success = await botManager.connectWithNumber(phoneNumber);

            if (success) {
                return res.json({
                    success: true,
                    message: 'Phone number connection initiated'
                });
            } else {
                return res.status(500).json({
                    error: 'Failed to connect with phone number'
                });
            }
        } catch (error) {
            logger.error('Error connecting with phone:', error);
            return res.status(500).json({
                error: 'Error initiating phone connection'
            });
        }
    }

    /**
     * Rename a WhatsApp number
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async renameNumber(req, res) {
        try {
            const { id, name } = req.body;

            if (!id || !name) {
                return res.status(400).json({
                    error: 'ID and name are required'
                });
            }

            const data = await Database.read(config.paths.numbers);
            const numbers = data.numbers || [];
            
            const numberIndex = numbers.findIndex(n => n.id === id);
            if (numberIndex === -1) {
                return res.status(404).json({
                    error: 'Number not found'
                });
            }

            numbers[numberIndex].name = name;
            await Database.write(config.paths.numbers, { numbers });

            return res.json({
                success: true,
                message: 'Number renamed successfully'
            });
        } catch (error) {
            logger.error('Error renaming number:', error);
            return res.status(500).json({
                error: 'Error renaming number'
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

            if (!id) {
                return res.status(400).json({
                    error: 'ID is required'
                });
            }

            await botManager.disconnect(id);

            return res.json({
                success: true,
                message: 'Number disconnected successfully'
            });
        } catch (error) {
            logger.error('Error disconnecting number:', error);
            return res.status(500).json({
                error: 'Error disconnecting number'
            });
        }
    }

    /**
     * Remove a WhatsApp number
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async removeNumber(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    error: 'ID is required'
                });
            }

            // First disconnect if connected
            try {
                await botManager.disconnect(id);
            } catch (error) {
                logger.warn(`Error disconnecting number ${id} before removal:`, error);
            }

            // Remove from database
            const data = await Database.read(config.paths.numbers);
            const numbers = data.numbers || [];
            
            const filteredNumbers = numbers.filter(n => n.id !== id);
            await Database.write(config.paths.numbers, { numbers: filteredNumbers });

            return res.json({
                success: true,
                message: 'Number removed successfully'
            });
        } catch (error) {
            logger.error('Error removing number:', error);
            return res.status(500).json({
                error: 'Error removing number'
            });
        }
    }

    /**
     * Get QR code status
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getQRStatus(req, res) {
        try {
            const { sessionId } = req.params;

            if (!sessionId) {
                return res.status(400).json({
                    error: 'Session ID is required'
                });
            }

            const qrCode = await botManager.getQRCode(sessionId);
            const status = qrCode ? 'pending' : 'connected';

            return res.json({
                success: true,
                data: {
                    status,
                    qrCode
                }
            });
        } catch (error) {
            logger.error('Error getting QR status:', error);
            return res.status(500).json({
                error: 'Error checking QR status'
            });
        }
    }

    /**
     * Render numbers management page
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async renderNumbersPage(req, res) {
        try {
            res.render('numbers', {
                title: 'Numbers Management',
                user: req.session.user
            });
        } catch (error) {
            logger.error('Error rendering numbers page:', error);
            res.status(500).render('error', {
                message: 'Error loading numbers page'
            });
        }
    }
}

module.exports = NumbersController;
