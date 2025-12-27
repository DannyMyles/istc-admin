const {
    createUser,
    getUsers,
    getSingleUser,
    updateUser,
    deleteUser
} = require("../controllers/index");

const { 
    createRole, 
    getAllRoles, 
    getRoleById, 
    updateRole, 
    deleteRole 
} = require("../controllers/index");

const { authenticateUser } = require("../middleware/index");

const express = require("express");
const router = express.Router();

// User routes
router.post('/users', authenticateUser, createUser);
router.get('/users', authenticateUser, getUsers);
router.get('/users/:id', authenticateUser, getSingleUser);
router.put('/users/:id', authenticateUser, updateUser);
router.delete('/users/:id', authenticateUser, deleteUser);

// Role routes
router.post('/roles', authenticateUser, createRole);
router.get('/roles', authenticateUser, getAllRoles);
router.get('/roles/:id', authenticateUser, getRoleById);
router.put('/roles/:id', authenticateUser, updateRole);
router.delete('/roles/:id', authenticateUser, deleteRole);

module.exports = router;