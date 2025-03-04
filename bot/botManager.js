const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
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
     * Initialize the bot manager
     */
    async init() {
        try {
            // Load settings
            const data = await Database.read(config.paths.settings);
            if (data.settings) {
                this.settings = { ...this.settings, ...data.settings };
            }

            // Load existing numbers and try to reconnect
            const numbersData = await Database.read(config.paths.numbers);
            if (Array.isArray(numbersData.numbers)) {
                for (const number of numbersData.numbers) {
                    await this.connect(number.id);
                }
            }

            logger.info('Bot manager initialized successfully');
        } catch (error) {
            logger.error('Error initializing bot manager:', error);
            throw error;
        }
    }

    /**
     * Connect to WhatsApp with a specific session ID
     * @param {string} sessionId - Session identifier
     * @returns {Promise<void>}
     */
    async connect(sessionId) {
        try {
            // Get auth state
            const authPath = path.join(config.paths.data, 'auth', sessionId);
            const { state, saveCreds } = await useMultiFileAuthState(authPath);

            // Create socket connection
            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                defaultQueryTimeoutMs: 60000
            });

            // Handle connection updates
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    // Generate QR code
                    try {
                        const qrImage = await qrcode.toDataURL(qr);
                        this.qrCodes.set(sessionId, qrImage);
                        logger.info(`QR code generated for session ${sessionId}`);
                    } catch (error) {
                        logger.error(`Error generating QR code for session ${sessionId}:`, error);
                    }
                }

                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    logger.info(`Connection closed for session ${sessionId}. Reconnect: ${shouldReconnect}`);
                    
                    if (shouldReconnect) {
                        await this.connect(sessionId);
                    }
                } else if (connection === 'open') {
                    logger.info(`Connected successfully for session ${sessionId}`);
                    this.qrCodes.delete(sessionId);
                    this.connections.set(sessionId, sock);

                    // Update connection status in database
                    await this.updateConnectionStatus(sessionId, 'connected');
                }
            });

            // Handle credentials update
            sock.ev.on('creds.update', saveCreds);

            // Handle messages
            sock.ev.on('messages.upsert', async ({ messages }) => {
                for (const message of messages) {
                    if (!message.key.fromMe) {
                        await this.handleIncomingMessage(sock, message);
                    }
                }
            });

            // Store connection
            this.connections.set(sessionId, sock);
            logger.info(`Connection initialized for session ${sessionId}`);

        } catch (error) {
            logger.error(`Error connecting session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Handle incoming messages
     * @param {Object} sock - WhatsApp socket connection
     * @param {Object} message - Incoming message
     */
    async handleIncomingMessage(sock, message) {
        try {
            const { settings } = this;
            const jid = message.key.remoteJid;

            // Auto read messages if enabled
            if (settings.autoRead) {
                await sock.readMessages([message.key]);
            }

            // Check working hours if enabled
            if (settings.workingHours.enabled && !this.isWithinWorkingHours()) {
                if (settings.absenceMessage) {
                    await this.sendMessage(sock, jid, { text: settings.absenceMessage });
                }
                return;
            }

            // Process message with random delay if auto-reply is enabled
            if (settings.autoReply) {
                const delay = Math.floor(
                    Math.random() * (settings.responseDelay.max - settings.responseDelay.min) +
                    settings.responseDelay.min
                );

                setTimeout(async () => {
                    await this.processMessage(sock, message);
                }, delay);
            }

        } catch (error) {
            logger.error('Error handling incoming message:', error);
        }
    }

    /**
     * Process and respond to messages
     * @param {Object} sock - WhatsApp socket connection
     * @param {Object} message - Message to process
     */
    async processMessage(sock, message) {
        try {
            const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
            if (!text) return;

            // Check for matching template
            const template = this.settings.messageTemplates.find(t => 
                text.toLowerCase().includes(t.trigger?.toLowerCase())
            );

            if (template) {
                await this.sendMessage(sock, message.key.remoteJid, {
                    text: template.content
                });
            }

        } catch (error) {
            logger.error('Error processing message:', error);
        }
    }

    /**
     * Send a message
     * @param {Object} sock - WhatsApp socket connection
     * @param {string} jid - Recipient JID
     * @param {Object} content - Message content
     */
    async sendMessage(sock, jid, content) {
        try {
            await sock.sendMessage(jid, content);
        } catch (error) {
            logger.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Disconnect a session
     * @param {string} sessionId - Session to disconnect
     */
    async disconnect(sessionId) {
        try {
            const sock = this.connections.get(sessionId);
            if (sock) {
                sock.end();
                this.connections.delete(sessionId);
                await this.updateConnectionStatus(sessionId, 'disconnected');
                logger.info(`Disconnected session ${sessionId}`);
            }
        } catch (error) {
            logger.error(`Error disconnecting session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Update connection status in database
     * @param {string} sessionId - Session ID
     * @param {string} status - New status
     */
    async updateConnectionStatus(sessionId, status) {
        try {
            const data = await Database.read(config.paths.numbers);
            if (Array.isArray(data.numbers)) {
                await Database.updateInArray(
                    config.paths.numbers,
                    'numbers',
                    number => number.id === sessionId,
                    { status, lastStatusChange: new Date().toISOString() }
                );
            }
        } catch (error) {
            logger.error('Error updating connection status:', error);
        }
    }

    /**
     * Check if current time is within working hours
     * @returns {boolean}
     */
    isWithinWorkingHours() {
        const { workingHours } = this.settings;
        if (!workingHours.enabled) return true;

        const now = new Date();
        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
        const [endHour, endMinute] = workingHours.end.split(':').map(Number);

        const start = new Date(now);
        start.setHours(startHour, startMinute, 0);

        const end = new Date(now);
        end.setHours(endHour, endMinute, 0);

        return now >= start && now <= end;
    }

    /**
     * Get QR code for a session
     * @param {string} sessionId - Session ID
     * @returns {string|null} QR code data URL
     */
    getQRCode(sessionId) {
        return this.qrCodes.get(sessionId) || null;
    }

    /**
     * Get all active connections
     * @returns {Array} Array of connection info
     */
    async getConnections() {
        const connections = [];
        for (const [id, sock] of this.connections.entries()) {
            connections.push({
                id,
                status: sock.state.connection,
                lastSeen: sock.lastSeen
            });
        }
        return connections;
    }

    /**
     * Update bot settings
     * @param {Object} newSettings - New settings
     */
    async updateSettings(newSettings) {
        this.settings = {
            ...this.settings,
            ...newSettings
        };

        // Save to database
        await Database.write(config.paths.settings, {
            settings: this.settings
        });

        logger.info('Bot settings updated');
    }
}

module.exports = new BotManager();
