const express = require('express');
const router = express.Router();
const NumbersController = require('../controllers/numbersController');
const AuthController = require('../controllers/authController');
const { apiLimiter, whatsappLimiter } = require('../utils/rateLimiter');

// Apply authentication middleware to all routes
router.use(AuthController.isAuthenticated);

// Apply rate limiting to API endpoints
router.use('/api', apiLimiter);

// Numbers page
router.get('/numbers', NumbersController.renderNumbers);

// CRUD operations
router.post('/api/numbers', NumbersController.addNumber);
router.put('/api/numbers/:id', NumbersController.updateNumber);
router.delete('/api/numbers/:id', NumbersController.deleteNumber);

// Connection management (with WhatsApp rate limiting)
router.post('/api/numbers/:id/connect', whatsappLimiter, NumbersController.connectNumber);
router.post('/api/numbers/:id/disconnect', NumbersController.disconnectNumber);

// QR code endpoint
router.get('/api/numbers/:id/qr', NumbersController.getQRCode);

// Statistics endpoint
router.get('/api/numbers/:id/stats', NumbersController.getStats);

// Bulk operations (admin only)
router.post('/api/numbers/bulk/connect', AuthController.isAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        const results = [];

        for (const id of ids) {
            try {
                await NumbersController.connectNumber({ params: { id }, session: req.session });
                results.push({ id, success: true });
            } catch (error) {
                results.push({ id, success: false, error: error.message });
            }
        }

        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error performing bulk connect operation'
        });
    }
});

router.post('/api/numbers/bulk/disconnect', AuthController.isAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        const results = [];

        for (const id of ids) {
            try {
                await NumbersController.disconnectNumber({ params: { id }, session: req.session });
                results.push({ id, success: true });
            } catch (error) {
                results.push({ id, success: false, error: error.message });
            }
        }

        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error performing bulk disconnect operation'
        });
    }
});

router.delete('/api/numbers/bulk', AuthController.isAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        const results = [];

        for (const id of ids) {
            try {
                await NumbersController.deleteNumber({ params: { id }, session: req.session });
                results.push({ id, success: true });
            } catch (error) {
                results.push({ id, success: false, error: error.message });
            }
        }

        res.json({
            success: true,
            results
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error performing bulk delete operation'
        });
    }
});

// Export router
module.exports = router;
