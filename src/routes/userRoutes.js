const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/authMiddleware");

// Import controllers
const userController = require("../controllers/userController");
const roleController = require("../controllers/roleController");

// User routes - all require authentication
router.post('/users', authenticate, authorize(['admin']), userController.createUser);
router.get('/users', authenticate, authorize(['admin']), userController.getUsers);
router.get('/users/:id', authenticate, authorize(['admin']), userController.getSingleUser);
router.put('/users/:id', authenticate, authorize(['admin']), userController.updateUser);
router.delete('/users/:id', authenticate, authorize(['admin']), userController.deleteUser);

// Role routes
router.post('/roles', authenticate, authorize(['admin']), roleController.createRole);
router.get('/roles', authenticate, authorize(['admin']), roleController.getAllRoles);
router.get('/roles/:id', authenticate, authorize(['admin']), roleController.getRoleById);
router.put('/roles/:id', authenticate, authorize(['admin']), roleController.updateRole);
router.delete('/roles/:id', authenticate, authorize(['admin']), roleController.deleteRole);

module.exports = router;