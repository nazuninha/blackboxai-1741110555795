const express = require('express');
const router = express.Router();
const multer = require('multer');
const SettingsController = require('../controllers/settingsController');
const AuthController = require('../controllers/authController');
const { apiLimiter } = require('../utils/rateLimiter');

// Configure multer for file uploads
const upload = multer({
    limits: {
        fileSize: 1024 * 1024 // 1MB limit
    }
});

// Apply authentication middleware to all routes
router.use(AuthController.isAuthenticated);

// Apply rate limiting to API endpoints
router.use('/api', apiLimiter);

// Settings page
router.get('/settings', SettingsController.renderSettings);

// Update settings
router.put('/api/settings', SettingsController.updateSettings);

// Message templates
router.post('/api/settings/templates', SettingsController.addTemplate);
router.put('/api/settings/templates/:id', SettingsController.updateTemplate);
router.delete('/api/settings/templates/:id', SettingsController.deleteTemplate);

// Export/Import settings (admin only)
router.get('/api/settings/export', AuthController.isAdmin, SettingsController.exportSettings);
router.post('/api/settings/import', 
    AuthController.isAdmin,
    upload.single('settings'),
    async (req, res, next) => {
        try {
            // Parse JSON file
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({
                    error: 'No file uploaded'
                });
            }

            const settings = JSON.parse(req.file.buffer.toString());
            req.body = settings;
            next();
        } catch (error) {
            res.status(400).json({
                error: 'Invalid JSON file'
            });
        }
    },
    SettingsController.importSettings
);

// Bulk operations (admin only)
router.post('/api/settings/templates/bulk', AuthController.isAdmin, async (req, res) => {
    try {
        const { templates } = req.body;
        const results = [];

        for (const template of templates) {
            try {
                const result = await SettingsController.addTemplate({
                    body: template,
                    session: req.session
                }, {
                    json: (data) => results.push({ ...data, templateName: template.name })
                });
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    templateName: template.name
                });
            }
        }

        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error performing bulk template operation'
        });
    }
});

router.delete('/api/settings/templates/bulk', AuthController.isAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        const results = [];

        for (const id of ids) {
            try {
                await SettingsController.deleteTemplate({
                    params: { id },
                    session: req.session
                }, {
                    json: (data) => results.push({ ...data, templateId: id })
                });
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    templateId: id
                });
            }
        }

        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error performing bulk template deletion'
        });
    }
});

// Reset settings to defaults (admin only)
router.post('/api/settings/reset', AuthController.isAdmin, async (req, res) => {
    try {
        await SettingsController.updateSettings({
            body: config.botDefaults,
            session: req.session
        }, res);
    } catch (error) {
        res.status(500).json({
            error: 'Error resetting settings'
        });
    }
});

module.exports = router;
