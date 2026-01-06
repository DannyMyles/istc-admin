const userController = require("./userController");
const roleController = require("./roleController");
const authController = require("./authController");

module.exports = {
    // User controller
    createUser: userController.createUser,
    getUsers: userController.getUsers,
    getSingleUser: userController.getSingleUser,
    updateUser: userController.updateUser,
    deleteUser: userController.deleteUser,
    
    // Role controller
    createRole: roleController.createRole,
    getAllRoles: roleController.getAllRoles,
    getRoleById: roleController.getRoleById,
    updateRole: roleController.updateRole,
    deleteRole: roleController.deleteRole,
    
    // Auth controller
    registerUser: authController.registerUser,
    loginUser: authController.loginUser,
    logoutUser: authController.logoutUser,
    getCurrentUser: authController.getCurrentUser,
    updateProfile: authController.updateProfile,
    forgotPassword: authController.forgotPassword,
    resetPassword: authController.resetPassword,
    verifyResetToken: authController.verifyResetToken,
    changePassword: authController.changePassword,
    submitContactForm: authController.submitContactForm
};