const express = require('express');
const router = express.Router();
const NumbersController = require('../controllers/numbersController');
const AuthController = require('../controllers/authController');

// Apply authentication middleware to all numbers routes
router.use(AuthController.isAuthenticated);

// Main numbers management page
router.get('/numbers', NumbersController.renderNumbersPage);

// Get all numbers
router.get('/api/numbers', NumbersController.getNumbers);

// Connect new number via QR code
router.post('/api/numbers/connect/qr', NumbersController.connectWithQR);

// Connect new number via phone number
router.post('/api/numbers/connect/phone', NumbersController.connectWithPhone);

// Get QR code status
router.get('/api/numbers/qr-status/:sessionId', NumbersController.getQRStatus);

// Rename a number
router.put('/api/numbers/rename', NumbersController.renameNumber);

// Disconnect a number
router.post('/api/numbers/disconnect/:id', NumbersController.disconnectNumber);

// Remove a number
router.delete('/api/numbers/remove/:id', NumbersController.removeNumber);

// Bulk actions (Admin only)
router.post('/api/numbers/bulk', AuthController.isAdmin, async (req, res) => {
    try {
        const { action, ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                error: 'Invalid or empty IDs array'
            });
        }

        switch (action) {
            case 'disconnect':
                await Promise.all(ids.map(id => NumbersController.disconnectNumber({ params: { id } }, res)));
                break;
            case 'remove':
                await Promise.all(ids.map(id => NumbersController.removeNumber({ params: { id } }, res)));
                break;
            default:
                return res.status(400).json({
                    error: 'Invalid action'
                });
        }

        return res.json({
            success: true,
            message: `Bulk ${action} completed successfully`
        });
    } catch (error) {
        return res.status(500).json({
            error: `Error performing bulk ${action}`
        });
    }
});

// Export numbers data (Admin only)
router.get('/api/numbers/export', AuthController.isAdmin, async (req, res) => {
    try {
        const numbers = await NumbersController.getNumbers(req, res);
        res.attachment('whatsapp-numbers.json');
        res.json(numbers);
    } catch (error) {
        res.status(500).json({
            error: 'Error exporting numbers data'
        });
    }
});

// Import numbers data (Admin only)
router.post('/api/numbers/import', AuthController.isAdmin, async (req, res) => {
    try {
        const { numbers } = req.body;

        if (!Array.isArray(numbers)) {
            return res.status(400).json({
                error: 'Invalid numbers data'
            });
        }

        // Validate each number entry
        for (const number of numbers) {
            if (!number.id || !number.name) {
                return res.status(400).json({
                    error: 'Invalid number entry format'
                });
            }
        }

        // Update database with imported numbers
        const Database = require('../utils/database');
        await Database.write(require('../config/config').paths.numbers, { numbers });

        return res.json({
            success: true,
            message: 'Numbers imported successfully'
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Error importing numbers data'
        });
    }
});

module.exports = router;
