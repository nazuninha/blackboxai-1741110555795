const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authLimiter } = require('../utils/rateLimiter');

// Apply rate limiting to authentication routes
router.use(['/login', '/forgot-password', '/reset-password'], authLimiter);

// Login routes
router.get('/login', AuthController.renderLogin);
router.post('/login', AuthController.login);

// Logout route
router.post('/logout', AuthController.logout);
router.get('/logout', (req, res) => {
    res.redirect('/login');
});

// Forgot password routes
router.get('/forgot-password', AuthController.renderForgotPassword);
router.post('/forgot-password', AuthController.forgotPassword);

// Reset password routes
router.get('/reset-password/:token', AuthController.renderResetPassword);
router.post('/reset-password/:token', AuthController.resetPassword);

// Profile routes (protected)
router.get('/profile', AuthController.isAuthenticated, async (req, res) => {
    try {
        res.render('profile', {
            user: req.session.user,
            path: '/profile'
        });
    } catch (error) {
        res.render('error', {
            message: 'Error loading profile'
        });
    }
});

router.put('/api/profile', AuthController.isAuthenticated, async (req, res) => {
    try {
        const { name, email, currentPassword, newPassword } = req.body;
        const userId = req.session.user.id;

        // Get user from database
        const data = await Database.read(config.paths.users);
        const user = data.users.find(u => u.id === userId);

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Verify current password if changing password
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    error: 'Current password is required'
                });
            }

            const validPassword = await bcrypt.compare(currentPassword, user.password);
            if (!validPassword) {
                return res.status(400).json({
                    error: 'Current password is incorrect'
                });
            }
        }

        // Check if email is already taken
        if (email !== user.email) {
            const emailExists = data.users.some(u => u.email === email);
            if (emailExists) {
                return res.status(400).json({
                    error: 'Email is already taken'
                });
            }
        }

        // Update user
        const updates = {
            name: name || user.name,
            email: email || user.email,
            updatedAt: new Date().toISOString()
        };

        if (newPassword) {
            updates.password = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
        }

        await Database.updateInArray(
            config.paths.users,
            'users',
            u => u.id === userId,
            updates
        );

        // Update session
        req.session.user = {
            ...req.session.user,
            name: updates.name,
            email: updates.email
        };

        logger.logAudit('Profile updated', userId);

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        logger.error('Profile update error:', error);
        res.status(500).json({
            error: 'Error updating profile'
        });
    }
});

// Change avatar
router.post('/api/profile/avatar', 
    AuthController.isAuthenticated,
    upload.single('avatar'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: 'No file uploaded'
                });
            }

            const userId = req.session.user.id;
            const avatarPath = `/uploads/avatars/${userId}.jpg`;
            const avatarFullPath = path.join(__dirname, '..', 'public', avatarPath);

            // Ensure directory exists
            await fs.mkdir(path.dirname(avatarFullPath), { recursive: true });

            // Process and save avatar
            await sharp(req.file.buffer)
                .resize(200, 200)
                .jpeg({ quality: 90 })
                .toFile(avatarFullPath);

            // Update user
            await Database.updateInArray(
                config.paths.users,
                'users',
                u => u.id === userId,
                {
                    avatar: avatarPath,
                    updatedAt: new Date().toISOString()
                }
            );

            // Update session
            req.session.user = {
                ...req.session.user,
                avatar: avatarPath
            };

            logger.logAudit('Avatar updated', userId);

            res.json({
                success: true,
                avatar: avatarPath
            });
        } catch (error) {
            logger.error('Avatar update error:', error);
            res.status(500).json({
                error: 'Error updating avatar'
            });
        }
    }
);

module.exports = router;
