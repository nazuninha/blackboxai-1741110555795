const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settingsController');
const AuthController = require('../controllers/authController');

// Apply authentication middleware to all settings routes
router.use(AuthController.isAuthenticated);

// Main settings page
router.get('/settings', SettingsController.renderSettingsPage);

// Get current settings
router.get('/api/settings', SettingsController.getSettings);

// Update settings
router.put('/api/settings', SettingsController.updateSettings);

// Reset settings to defaults
router.post('/api/settings/reset', AuthController.isAdmin, SettingsController.resetSettings);

// Export settings (Admin only)
router.get('/api/settings/export', AuthController.isAdmin, SettingsController.exportSettings);

// Import settings (Admin only)
router.post('/api/settings/import', AuthController.isAdmin, SettingsController.importSettings);

// Update specific setting groups
router.put('/api/settings/response-delay', async (req, res) => {
    try {
        const { min, max } = req.body;
        await SettingsController.updateSettings(req, {
            ...res,
            body: {
                responseDelay: { min, max }
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error updating response delay settings'
        });
    }
});

router.put('/api/settings/working-hours', async (req, res) => {
    try {
        const { start, end, timezone } = req.body;
        await SettingsController.updateSettings(req, {
            ...res,
            body: {
                workingHours: { start, end, timezone }
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error updating working hours settings'
        });
    }
});

router.put('/api/settings/message-templates', async (req, res) => {
    try {
        const { templates } = req.body;
        await SettingsController.updateSettings(req, {
            ...res,
            body: {
                messageTemplates: templates
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error updating message templates'
        });
    }
});

router.put('/api/settings/absence-message', async (req, res) => {
    try {
        const { message } = req.body;
        await SettingsController.updateSettings(req, {
            ...res,
            body: {
                absenceMessage: message
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error updating absence message'
        });
    }
});

// Toggle features
router.post('/api/settings/toggle/:feature', async (req, res) => {
    try {
        const { feature } = req.params;
        const { enabled } = req.body;

        // Validate feature
        const validFeatures = ['autoRead', 'autoReply', 'workingHours'];
        if (!validFeatures.includes(feature)) {
            return res.status(400).json({
                error: 'Invalid feature'
            });
        }

        await SettingsController.updateSettings(req, {
            ...res,
            body: {
                [feature]: enabled
            }
        });
    } catch (error) {
        res.status(500).json({
            error: `Error toggling ${feature}`
        });
    }
});

// Validate settings
router.post('/api/settings/validate', (req, res) => {
    const error = SettingsController.validateSettings(req.body);
    if (error) {
        return res.status(400).json({ error });
    }
    res.json({ valid: true });
});

module.exports = router;
