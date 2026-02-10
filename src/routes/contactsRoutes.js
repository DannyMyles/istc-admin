const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// All routes require authentication and admin/editor role
router.use(authenticate);
router.use(authorize(['admin', 'editor']));

// Public contact submission is handled in authRoutes via /api/v1/auth/contact

// Admin routes for contact management
router.get('/', contactController.getAllContacts);
router.get('/stats', contactController.getContactStats);
router.get('/:id', contactController.getContactById);
router.patch('/:id/status', contactController.updateContactStatus);
router.delete('/:id', contactController.deleteContact);

module.exports = router;

