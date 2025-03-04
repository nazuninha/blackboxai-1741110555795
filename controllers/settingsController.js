const Database = require('../utils/database');
const logger = require('../utils/logger');
const config = require('../config/config');
const botManager = require('../bot/botManager');

class SettingsController {
    /**
     * Get all settings
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getSettings(req, res) {
        try {
            const data = await Database.read(config.paths.settings);
            return res.json({
                success: true,
                data: data.settings || config.botDefaults
            });
        } catch (error) {
            logger.error('Error getting settings:', error);
            return res.status(500).json({
                error: 'Error fetching settings'
            });
        }
    }

    /**
     * Update settings
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async updateSettings(req, res) {
        try {
            const newSettings = req.body;

            // Validate settings
            const validationError = this.validateSettings(newSettings);
            if (validationError) {
                return res.status(400).json({
                    error: validationError
                });
            }

            // Read current settings
            const data = await Database.read(config.paths.settings);
            
            // Merge with existing settings
            const updatedSettings = {
                ...data.settings || config.botDefaults,
                ...newSettings,
                updatedAt: new Date().toISOString()
            };

            // Save settings
            await Database.write(config.paths.settings, {
                settings: updatedSettings
            });

            // Apply settings to active connections
            await botManager.updateSettings(updatedSettings);

            // Log settings update
            logger.info('Settings updated', {
                userId: req.session.user.id,
                changes: newSettings
            });

            return res.json({
                success: true,
                data: updatedSettings
            });
        } catch (error) {
            logger.error('Error updating settings:', error);
            return res.status(500).json({
                error: 'Error updating settings'
            });
        }
    }

    /**
     * Validate settings object
     * @param {Object} settings - Settings to validate
     * @returns {string|null} Error message or null if valid
     */
    static validateSettings(settings) {
        // Validate response delay
        if (settings.responseDelay) {
            const { min, max } = settings.responseDelay;
            if (typeof min !== 'number' || typeof max !== 'number') {
                return 'Response delay must be numbers';
            }
            if (min < 0 || max < 0) {
                return 'Response delay cannot be negative';
            }
            if (min > max) {
                return 'Minimum delay cannot be greater than maximum delay';
            }
        }

        // Validate auto read setting
        if ('autoRead' in settings && typeof settings.autoRead !== 'boolean') {
            return 'Auto read must be a boolean';
        }

        // Validate inactivity timeout
        if ('inactivityTimeout' in settings) {
            if (typeof settings.inactivityTimeout !== 'number') {
                return 'Inactivity timeout must be a number';
            }
            if (settings.inactivityTimeout < 0) {
                return 'Inactivity timeout cannot be negative';
            }
        }

        // Validate absence message
        if ('absenceMessage' in settings) {
            if (typeof settings.absenceMessage !== 'string') {
                return 'Absence message must be a string';
            }
            if (settings.absenceMessage.length > 1000) {
                return 'Absence message too long (max 1000 characters)';
            }
        }

        // Validate working hours
        if (settings.workingHours) {
            const { start, end, timezone } = settings.workingHours;
            if (!start || !end || !timezone) {
                return 'Working hours must include start, end, and timezone';
            }
            // Validate time format (HH:mm)
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(start) || !timeRegex.test(end)) {
                return 'Invalid time format (use HH:mm)';
            }
        }

        // Validate message templates
        if (settings.messageTemplates) {
            if (!Array.isArray(settings.messageTemplates)) {
                return 'Message templates must be an array';
            }
            for (const template of settings.messageTemplates) {
                if (!template.name || !template.content) {
                    return 'Each template must have a name and content';
                }
                if (template.content.length > 1000) {
                    return 'Template content too long (max 1000 characters)';
                }
            }
        }

        return null;
    }

    /**
     * Reset settings to defaults
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async resetSettings(req, res) {
        try {
            await Database.write(config.paths.settings, {
                settings: config.botDefaults
            });

            // Apply default settings to active connections
            await botManager.updateSettings(config.botDefaults);

            logger.info('Settings reset to defaults', {
                userId: req.session.user.id
            });

            return res.json({
                success: true,
                data: config.botDefaults
            });
        } catch (error) {
            logger.error('Error resetting settings:', error);
            return res.status(500).json({
                error: 'Error resetting settings'
            });
        }
    }

    /**
     * Export settings
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async exportSettings(req, res) {
        try {
            const data = await Database.read(config.paths.settings);
            res.attachment('whatsapp-bot-settings.json');
            return res.json(data.settings || config.botDefaults);
        } catch (error) {
            logger.error('Error exporting settings:', error);
            return res.status(500).json({
                error: 'Error exporting settings'
            });
        }
    }

    /**
     * Import settings
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async importSettings(req, res) {
        try {
            const settings = req.body;

            // Validate imported settings
            const validationError = this.validateSettings(settings);
            if (validationError) {
                return res.status(400).json({
                    error: validationError
                });
            }

            // Save imported settings
            await Database.write(config.paths.settings, {
                settings: {
                    ...settings,
                    importedAt: new Date().toISOString()
                }
            });

            // Apply imported settings to active connections
            await botManager.updateSettings(settings);

            logger.info('Settings imported', {
                userId: req.session.user.id
            });

            return res.json({
                success: true,
                message: 'Settings imported successfully'
            });
        } catch (error) {
            logger.error('Error importing settings:', error);
            return res.status(500).json({
                error: 'Error importing settings'
            });
        }
    }

    /**
     * Render settings page
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async renderSettingsPage(req, res) {
        try {
            res.render('settings', {
                title: 'Bot Settings',
                user: req.session.user
            });
        } catch (error) {
            logger.error('Error rendering settings page:', error);
            res.status(500).render('error', {
                message: 'Error loading settings page'
            });
        }
    }
}

module.exports = SettingsController;
