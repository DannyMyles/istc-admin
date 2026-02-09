const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Op } = require('sequelize');
const { asyncWrapper, HTTP_STATUS_CODES } = require("../middleware/index");
const { User, Role, Contact, PasswordResetToken } = require("../models");
const EmailService = require("../utils/emailService");
require("dotenv").config();

// Helper function to generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            roleId: user.roleId,
            role: user.role,
            email: user.email
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "3h" }
    );
};

// Generate secure reset token
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// ==================== LOGIN ====================
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Email and password are required'
            });
        }

        const user = await User.findOne({
            where: { email },
            include: [
                { model: Role, as: 'userRole', attributes: ['id', 'name'] }
            ]
        });

        if (!user) {
            return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
                error: 'Invalid credentials'
            });
        }

        // Need to fetch password separately since it's excluded by default
        const userWithPassword = await User.findByPk(user.id, {
            attributes: { include: ['password'] }
        });

        const isPasswordValid = await bcrypt.compare(password, userWithPassword.password);

        if (!isPasswordValid) {
            return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
                error: 'Invalid credentials'
            });
        }

        if (!user.isActive) {
            return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
                error: 'Account is deactivated'
            });
        }

        const token = generateToken(user);

        // Remove sensitive data
        const userResponse = user.toJSON ? user.toJSON() : { ...user.get() };
        delete userResponse.password;

        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Login successful',
            user: userResponse,
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Login failed'
        });
    }
};

// ==================== LOGOUT ====================
const logoutUser = async (req, res) => {
    try {
        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Logout failed'
        });
    }
};

// ==================== GET CURRENT USER ====================
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.userId, {
            attributes: { exclude: ['password'] },
            include: [
                { model: Role, as: 'userRole', attributes: ['id', 'name'] }
            ]
        });

        if (!user) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: 'User not found'
            });
        }

        return res.status(HTTP_STATUS_CODES.OK).json({
            user: user.toJSON ? user.toJSON() : user.get()
        });
    } catch (error) {
        console.error('Get current user error:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to get user data'
        });
    }
};

// ==================== UPDATE PROFILE ====================
const updateProfile = async (req, res) => {
    try {
        const { name, username, email } = req.body;
        const userId = req.userId;

        const updates = {};
        if (name) updates.name = name;
        if (username) updates.username = username;
        if (email) updates.email = email;

        const user = await User.update(
            updates,
            {
                where: { id: userId },
                returning: true,
                individualHooks: true
            }
        );

        // Fetch the updated user
        const updatedUser = await User.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [
                { model: Role, as: 'userRole', attributes: ['id', 'name'] }
            ]
        });

        if (!updatedUser) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: 'User not found'
            });
        }

        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Profile updated successfully',
            user: updatedUser.toJSON ? updatedUser.toJSON() : updatedUser.get()
        });
    } catch (error) {
        console.error('Update profile error:', error);

        if (error.name === 'SequelizeUniqueConstraintError') {
            const field = error.errors[0].path === 'email' ? 'email' : 'username';
            return res.status(HTTP_STATUS_CODES.CONFLICT).json({
                error: `User with this ${field} already exists`
            });
        }

        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to update profile'
        });
    }
};

// ==================== CONTACT FORM ====================
const submitContactForm = async (req, res) => {
    try {
        const { name, email, subject, message, phone, category } = req.body;

        // Validation
        if (!name || !email || !subject || !message) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Name, email, subject, and message are required'
            });
        }

        // Check for spam (multiple submissions within 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentSubmission = await Contact.findOne({
            where: {
                email,
                createdAt: { [Op.gte]: fiveMinutesAgo }
            }
        });

        if (recentSubmission) {
            return res.status(HTTP_STATUS_CODES.TOO_MANY_REQUESTS).json({
                error: 'Please wait before submitting another message'
            });
        }

        // Create contact submission
        const contact = await Contact.create({
            name,
            email,
            subject,
            message,
            phone,
            category: category || 'general',
            userId: req.userId || null
        });

        // Send confirmation email to user
        await EmailService.sendContactConfirmation(email, name, message);

        // Send notification to admin
        const adminEmail = process.env.ADMIN_EMAIL || 'muhadiwawire@gmail.com';
        await EmailService.sendContactNotification(adminEmail, {
            name,
            email,
            subject,
            message,
            phone,
            createdAt: contact.createdAt
        });

        return res.status(HTTP_STATUS_CODES.CREATED).json({
            message: 'Thank you for contacting us. We will get back to you soon.',
            contactId: contact.id
        });
    } catch (error) {
        console.error('Error submitting contact form:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to submit contact form'
        });
    }
};

// ==================== REGISTRATION ====================
const registerUser = async (req, res) => {
    try {
        const { name, username, email, password, roleName } = req.body;

        if (!name || !username || !email || !password) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: "All fields are required"
            });
        }

        // Password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
            });
        }

        // Check existing user
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [{ email }, { username }]
            }
        });

        if (existingUser) {
            const field = existingUser.email === email ? "email" : "username";
            return res.status(HTTP_STATUS_CODES.CONFLICT).json({
                message: `User with this ${field} already exists`
            });
        }

        // Determine role
        let role;
        if (roleName) {
            role = await Role.findOne({ where: { name: roleName } });
            if (!role) {
                const availableRoles = await Role.findAll({ where: { isActive: true }, attributes: ['name'] });
                return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                    message: `Invalid role. Available roles: ${availableRoles.map(r => r.name).join(', ')}`
                });
            }
        } else {
            // Default role for new users
            role = await Role.getDefaultRole();
        }

        // Create user
        const user = await User.create({
            name,
            username,
            email,
            password,
            roleId: role.id,
            role: role.name
        });

        // Send welcome email
        await EmailService.sendWelcomeEmail(email, name);

        // Generate token
        const token = generateToken(user);

        // Remove sensitive data from response
        const userResponse = {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role
        };

        return res.status(HTTP_STATUS_CODES.CREATED).json({
            message: "Registration successful",
            user: userResponse,
            token
        });
    } catch (error) {
        console.error("Registration error:", error);

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(HTTP_STATUS_CODES.CONFLICT).json({
                message: "User already exists"
            });
        }

        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            message: "Registration failed"
        });
    }
};

// ==================== FORGOT PASSWORD ====================
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Email is required'
            });
        }

        const user = await User.findOne({ where: { email } });

        // For security, don't reveal if user exists
        if (!user) {
            return res.status(HTTP_STATUS_CODES.OK).json({
                message: 'If an account exists with this email, you will receive a reset link shortly.'
            });
        }

        // Check for recent reset requests
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentRequest = await PasswordResetToken.findOne({
            where: {
                userId: user.id,
                createdAt: { [Op.gte]: fiveMinutesAgo },
                isUsed: false
            }
        });

        if (recentRequest) {
            return res.status(HTTP_STATUS_CODES.TOO_MANY_REQUESTS).json({
                error: 'Please check your email or wait before requesting another reset'
            });
        }

        // Generate and save reset token
        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await PasswordResetToken.create({
            userId: user.id,
            token: resetToken,
            expiresAt,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Send reset email
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        await EmailService.sendPasswordReset(email, resetToken, user.name);

        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Password reset instructions sent to your email'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to process password reset request'
        });
    }
};

// ==================== RESET PASSWORD ====================
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        if (!token || !newPassword || !confirmPassword) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Token and new password are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Passwords do not match'
            });
        }

        // Password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
            });
        }

        // Find valid reset token
        const resetTokenDoc = await PasswordResetToken.findOne({
            where: {
                token,
                expiresAt: { [Op.gt]: new Date() },
                isUsed: false
            },
            include: [
                { model: User, as: 'user', attributes: ['id', 'password'] }
            ]
        });

        if (!resetTokenDoc) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Invalid or expired reset token'
            });
        }

        const user = resetTokenDoc.user || await User.findByPk(resetTokenDoc.userId);

        // Check if new password is same as old
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'New password cannot be the same as old password'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Mark token as used
        resetTokenDoc.isUsed = true;
        await resetTokenDoc.save();

        // Send confirmation email
        await EmailService.sendPasswordChangedNotification(user.email, user.name);

        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Password reset successful. You can now login with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to reset password'
        });
    }
};

// ==================== VERIFY RESET TOKEN ====================
const verifyResetToken = async (req, res) => {
    try {
        const { token } = req.params;

        const resetTokenDoc = await PasswordResetToken.findOne({
            where: {
                token,
                expiresAt: { [Op.gt]: new Date() },
                isUsed: false
            }
        });

        if (!resetTokenDoc) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                valid: false,
                error: 'Invalid or expired reset token'
            });
        }

        return res.status(HTTP_STATUS_CODES.OK).json({
            valid: true,
            message: 'Token is valid'
        });
    } catch (error) {
        console.error('Verify token error:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to verify token'
        });
    }
};

// ==================== CHANGE PASSWORD (AUTHENTICATED) ====================
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.userId;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'All password fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'New passwords do not match'
            });
        }

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: 'User not found'
            });
        }

        // Verify current password
        const isPasswordCorrect = await user.comparePassword(currentPassword);
        if (!isPasswordCorrect) {
            return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
                error: 'Current password is incorrect'
            });
        }

        // Check if new password is same as current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'New password cannot be the same as current password'
            });
        }

        // Password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Send notification email
        await EmailService.sendPasswordChangedNotification(user.email, user.name);

        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to change password'
        });
    }
};

module.exports = {
    submitContactForm,
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    updateProfile,
    forgotPassword,
    resetPassword,
    verifyResetToken,
    changePassword
};

