const config = require('../config/config');
const Database = require('../utils/database');
const logger = require('../utils/logger');
const botManager = require('../bot/botManager');

class SettingsController {
    /**
     * Render settings page
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async renderSettings(req, res) {
        try {
            // Get settings data
            const data = await Database.read(config.paths.settings);
            const settings = data.settings || config.botDefaults;

            res.render('settings', {
                user: req.session.user,
                settings,
                path: '/settings'
            });
        } catch (error) {
            logger.error('Error rendering settings page:', error);
            res.render('error', {
                message: 'Error loading settings'
            });
        }
    }

    /**
     * Update bot settings
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async updateSettings(req, res) {
        try {
            const updates = req.body;

            // Validate working hours if enabled
            if (updates.workingHours?.enabled) {
                const { start, end } = updates.workingHours;
                if (!start || !end || !start.match(/^\d{2}:\d{2}$/) || !end.match(/^\d{2}:\d{2}$/)) {
                    return res.status(400).json({
                        error: 'Invalid working hours format'
                    });
                }
            }

            // Validate response delay
            if (updates.responseDelay) {
                const { min, max } = updates.responseDelay;
                if (typeof min !== 'number' || typeof max !== 'number' || min < 0 || max < min) {
                    return res.status(400).json({
                        error: 'Invalid response delay values'
                    });
                }
            }

            // Update settings in database
            await Database.write(config.paths.settings, {
                settings: {
                    ...config.botDefaults,
                    ...updates,
                    updatedAt: new Date().toISOString(),
                    updatedBy: req.session.user.id
                }
            });

            // Update bot manager settings
            await botManager.updateSettings(updates);

            logger.logAudit('Settings updated', req.session.user.id, {
                updates
            });

            res.json({
                success: true,
                message: 'Settings updated successfully'
            });
        } catch (error) {
            logger.error('Error updating settings:', error);
            res.status(500).json({
                error: 'Error updating settings'
            });
        }
    }

    /**
     * Add message template
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async addTemplate(req, res) {
        try {
            const { name, trigger, content } = req.body;

            if (!name || !content) {
                return res.status(400).json({
                    error: 'Name and content are required'
                });
            }

            // Get current settings
            const data = await Database.read(config.paths.settings);
            const settings = data.settings || config.botDefaults;

            // Add template
            const template = {
                id: Date.now().toString(),
                name,
                trigger,
                content,
                createdAt: new Date().toISOString(),
                createdBy: req.session.user.id
            };

            settings.messageTemplates = settings.messageTemplates || [];
            settings.messageTemplates.push(template);

            // Save settings
            await Database.write(config.paths.settings, { settings });

            // Update bot manager settings
            await botManager.updateSettings(settings);

            logger.logAudit('Message template added', req.session.user.id, {
                templateId: template.id,
                name
            });

            res.json({
                success: true,
                template
            });
        } catch (error) {
            logger.error('Error adding template:', error);
            res.status(500).json({
                error: 'Error adding message template'
            });
        }
    }

    /**
     * Update message template
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async updateTemplate(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Get current settings
            const data = await Database.read(config.paths.settings);
            const settings = data.settings || config.botDefaults;

            // Find and update template
            settings.messageTemplates = settings.messageTemplates || [];
            const templateIndex = settings.messageTemplates.findIndex(t => t.id === id);

            if (templateIndex === -1) {
                return res.status(404).json({
                    error: 'Template not found'
                });
            }

            settings.messageTemplates[templateIndex] = {
                ...settings.messageTemplates[templateIndex],
                ...updates,
                updatedAt: new Date().toISOString(),
                updatedBy: req.session.user.id
            };

            // Save settings
            await Database.write(config.paths.settings, { settings });

            // Update bot manager settings
            await botManager.updateSettings(settings);

            logger.logAudit('Message template updated', req.session.user.id, {
                templateId: id,
                updates
            });

            res.json({
                success: true,
                template: settings.messageTemplates[templateIndex]
            });
        } catch (error) {
            logger.error('Error updating template:', error);
            res.status(500).json({
                error: 'Error updating message template'
            });
        }
    }

    /**
     * Delete message template
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async deleteTemplate(req, res) {
        try {
            const { id } = req.params;

            // Get current settings
            const data = await Database.read(config.paths.settings);
            const settings = data.settings || config.botDefaults;

            // Remove template
            settings.messageTemplates = (settings.messageTemplates || [])
                .filter(t => t.id !== id);

            // Save settings
            await Database.write(config.paths.settings, { settings });

            // Update bot manager settings
            await botManager.updateSettings(settings);

            logger.logAudit('Message template deleted', req.session.user.id, {
                templateId: id
            });

            res.json({
                success: true,
                message: 'Template deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting template:', error);
            res.status(500).json({
                error: 'Error deleting message template'
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
            // Get settings data
            const data = await Database.read(config.paths.settings);
            const settings = data.settings || config.botDefaults;

            // Remove sensitive data
            delete settings.updatedBy;

            // Set headers for download
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=whatsapp-bot-settings.json');

            res.json(settings);
        } catch (error) {
            logger.error('Error exporting settings:', error);
            res.status(500).json({
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

            // Validate settings structure
            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({
                    error: 'Invalid settings format'
                });
            }

            // Merge with defaults and save
            const mergedSettings = {
                ...config.botDefaults,
                ...settings,
                updatedAt: new Date().toISOString(),
                updatedBy: req.session.user.id
            };

            await Database.write(config.paths.settings, {
                settings: mergedSettings
            });

            // Update bot manager settings
            await botManager.updateSettings(mergedSettings);

            logger.logAudit('Settings imported', req.session.user.id);

            res.json({
                success: true,
                message: 'Settings imported successfully'
            });
        } catch (error) {
            logger.error('Error importing settings:', error);
            res.status(500).json({
                error: 'Error importing settings'
            });
        }
    }
}

module.exports = SettingsController;
