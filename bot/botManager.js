const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const config = require('../config/config');
const logger = require('../utils/logger');
const Database = require('../utils/database');

class BotManager {
    constructor() {
        this.connections = new Map();
        this.qrCodes = new Map();
        this.settings = config.botDefaults;
    }

    /**
     * Initialize bot manager
     */
    async init() {
        try {
            // Load settings
            const data = await Database.read(config.paths.settings);
            this.settings = { ...config.botDefaults, ...data.settings };

            // Load existing numbers and reconnect
            const numbersData = await Database.read(config.paths.numbers);
            const numbers = numbersData.numbers || [];

            for (const number of numbers) {
                if (number.autoReconnect) {
                    await this.connect(number.id);
                }
            }

            logger.logSystem('Bot manager initialized');
        } catch (error) {
            logger.error('Error initializing bot manager:', error);
            throw error;
        }
    }

    /**
     * Connect a WhatsApp number
     * @param {string} numberId - Number ID
     */
    async connect(numberId) {
        try {
            // Check if already connected
            if (this.connections.has(numberId)) {
                throw new Error('Number is already connected');
            }

            // Create client
            const client = new Client({
                authStrategy: new LocalAuth({ clientId: numberId }),
                puppeteer: {
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            });

            // Set up event handlers
            client.on('qr', async (qr) => {
                try {
                    // Generate QR code as data URL
                    const qrDataUrl = await qrcode.toDataURL(qr);
                    this.qrCodes.set(numberId, qrDataUrl);

                    logger.logWhatsApp('QR code generated', numberId);
                } catch (error) {
                    logger.error('Error generating QR code:', error);
                }
            });

            client.on('ready', async () => {
                // Clear QR code
                this.qrCodes.delete(numberId);

                // Update number status
                await Database.updateInArray(
                    config.paths.numbers,
                    'numbers',
                    n => n.id === numberId,
                    {
                        status: 'connected',
                        lastActive: new Date().toISOString()
                    }
                );

                logger.logWhatsApp('Client ready', numberId);
            });

            client.on('message', async (message) => {
                try {
                    await this.handleMessage(client, message, numberId);
                } catch (error) {
                    logger.error('Error handling message:', error);
                }
            });

            client.on('disconnected', async (reason) => {
                logger.logWhatsApp('Client disconnected', numberId, { reason });
                await this.disconnect(numberId);
            });

            // Initialize client
            await client.initialize();

            // Store connection
            this.connections.set(numberId, client);

            logger.logWhatsApp('Connection initiated', numberId);
        } catch (error) {
            logger.error('Error connecting number:', error);
            throw error;
        }
    }

    /**
     * Disconnect a WhatsApp number
     * @param {string} numberId - Number ID
     */
    async disconnect(numberId) {
        try {
            const client = this.connections.get(numberId);
            if (client) {
                await client.destroy();
                this.connections.delete(numberId);
                this.qrCodes.delete(numberId);

                // Update number status
                await Database.updateInArray(
                    config.paths.numbers,
                    'numbers',
                    n => n.id === numberId,
                    {
                        status: 'disconnected',
                        lastActive: new Date().toISOString()
                    }
                );

                logger.logWhatsApp('Client disconnected', numberId);
            }
        } catch (error) {
            logger.error('Error disconnecting number:', error);
            throw error;
        }
    }

    /**
     * Disconnect all WhatsApp numbers
     */
    async disconnectAll() {
        const promises = Array.from(this.connections.keys()).map(numberId => 
            this.disconnect(numberId)
        );
        await Promise.all(promises);
    }

    /**
     * Get QR code for a number
     * @param {string} numberId - Number ID
     * @returns {string|null} QR code data URL
     */
    getQRCode(numberId) {
        return this.qrCodes.get(numberId) || null;
    }

    /**
     * Get active connections
     * @returns {Array} Array of connected number IDs
     */
    getConnections() {
        return Array.from(this.connections.keys());
    }

    /**
     * Update bot settings
     * @param {Object} settings - New settings
     */
    async updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        logger.logSystem('Settings updated', { settings });
    }

    /**
     * Handle incoming message
     * @param {Object} client - WhatsApp client
     * @param {Object} message - Message object
     * @param {string} numberId - Number ID
     */
    async handleMessage(client, message, numberId) {
        try {
            // Ignore if auto-reply is disabled
            if (!this.settings.autoReply.enabled) {
                return;
            }

            // Check working hours if enabled
            if (this.settings.workingHours.enabled) {
                const now = new Date();
                const [startHour, startMinute] = this.settings.workingHours.start.split(':');
                const [endHour, endMinute] = this.settings.workingHours.end.split(':');
                const start = new Date(now).setHours(startHour, startMinute, 0);
                const end = new Date(now).setHours(endHour, endMinute, 0);

                if (now < start || now > end) {
                    await message.reply(this.settings.workingHours.outOfHoursMessage);
                    return;
                }
            }

            // Check for message templates
            const templates = this.settings.messageTemplates || [];
            for (const template of templates) {
                if (template.trigger && message.body.toLowerCase() === template.trigger.toLowerCase()) {
                    // Add random delay if configured
                    if (this.settings.responseDelay.max > 0) {
                        const delay = Math.random() * 
                            (this.settings.responseDelay.max - this.settings.responseDelay.min) + 
                            this.settings.responseDelay.min;
                        await new Promise(resolve => setTimeout(resolve, delay * 1000));
                    }

                    await message.reply(template.content);
                    return;
                }
            }

            // Send default auto-reply if no template matched
            await message.reply(this.settings.autoReply.message);

            // Update statistics
            await Database.updateInArray(
                config.paths.numbers,
                'numbers',
                n => n.id === numberId,
                {
                    'stats.received': (n.stats?.received || 0) + 1,
                    lastActive: new Date().toISOString()
                }
            );

            logger.logWhatsApp('Message handled', numberId, {
                from: message.from,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error handling message:', error);
            throw error;
        }
    }
}

module.exports = new BotManager();
