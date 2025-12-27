const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { asyncWrapper, HTTP_STATUS_CODES } = require("../middleware/index");
const { User, Role } = require("../models");
require("dotenv").config();

// Secret key for JWT
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "@mu(H)adywawire199990wewire!";

// Helper function to generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            userId: user._id, 
            roleId: user.roleId,
            role: user.role,
            email: user.email 
        }, 
        JWT_SECRET_KEY, 
        { expiresIn: "3h" }
    );
};

// Generate both access and refresh tokens
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { 
            userId: user._id, 
            roleId: user.roleId,
            role: user.role,
            email: user.email 
        }, 
        process.env.JWT_SECRET_KEY, 
        { expiresIn: "15m" } // Short-lived access token
    );
    
    const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET_KEY || process.env.JWT_SECRET_KEY + 'refresh',
        { expiresIn: "7d" } // Long-lived refresh token
    );
    
    return { accessToken, refreshToken };
};

// Refresh token endpoint
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Refresh token is required'
            });
        }

        const decoded = jwt.verify(
            refreshToken, 
            process.env.JWT_REFRESH_SECRET_KEY || process.env.JWT_SECRET_KEY + 'refresh'
        );
        
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: 'User not found'
            });
        }

        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
        
        return res.status(HTTP_STATUS_CODES.OK).json({
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error('Error refreshing token:', error);
        return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
            error: 'Invalid refresh token'
        });
    }
};

// Register a new user
const registerUser = async (req, res) => {
    try {
        const { name, username, email, password, roleName } = req.body; // Changed from roleId to roleName

        if (!name || !username || !email || !password || !roleName) {
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ message: "All fields are required" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            const field = existingUser.email === email ? "email" : "username";
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ message: `User with this ${field} already exists` });
        }

        // Find role by name instead of ID
        const roleExists = await Role.findOne({ name: roleName });
        if (!roleExists) {
            // List available roles for better error message
            const availableRoles = await Role.find({}, 'name');
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ 
                    message: `Invalid role name provided. Available roles: ${availableRoles.map(r => r.name).join(', ')}` 
                });
        }

        // Create new user
        const newUser = new User({
            name,
            username,
            email,
            password,
            roleId: roleExists._id, // Use the actual ObjectId
            role: roleExists.name
        });

        await newUser.save();

        const token = generateToken(newUser);

        return res.status(HTTP_STATUS_CODES.CREATED).json({
            message: "User registered successfully",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                username: newUser.username,
                role: newUser.role,
                roleId: newUser.roleId,
                token: token,
            },
        });
    } catch (error) {
        console.error("Error registering user:", error);

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ message: `${field} already exists` });
        } else if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map(err => err.message);
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ message: messages.join(', ') });
        } else if (error.name === "CastError") {
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ message: "Invalid data format" });
        }

        return res
            .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
            .json({ message: "Internal server error" });
    }
};

// Login a user
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ error: "Email and Password are required" });
        }

        // Find user with password
        const user = await User.findOne({ email })
            .select('+password')
            .populate('roleId', 'name -_id');

        if (!user) {
            return res
                .status(HTTP_STATUS_CODES.NOT_FOUND)
                .json({ error: "User not found" });
        }

        // Compare password
        const isPasswordCorrect = await user.comparePassword(password);
        if (!isPasswordCorrect) {
            return res
                .status(HTTP_STATUS_CODES.UNAUTHORIZED)
                .json({ error: "Invalid credentials" });
        }

        // Update last login
        user.lastLogin = Date.now();
        await user.save({ validateBeforeSave: false });

        // Generate JWT token
        const token = generateToken(user);

        return res.status(HTTP_STATUS_CODES.OK).json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                username: user.username,
                role: user.role,
                roleName: user.roleId?.name || 'user',
                token: token,
            },
        });
    } catch (error) {
        console.error("Error during login:", error);
        return res
            .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
            .json({ error: "An error occurred during login" });
    }
};

// Logout a user
const logoutUser = async (req, res) => {
    try {
        return res
            .status(HTTP_STATUS_CODES.OK)
            .json({ 
                message: "Logged out successfully",
                note: "Please delete the token from client storage"
            });
    } catch (error) {
        console.error("Error during logout:", error);
        return res
            .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
            .json({ error: "An error occurred during logout" });
    }
};

// Get current user
const getCurrentUser = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ error: "User ID not found in request" });
        }

        const user = await User.findById(userId)
            .select('-password')
            .populate('roleId', 'name -_id');

        if (!user) {
            return res
                .status(HTTP_STATUS_CODES.NOT_FOUND)
                .json({ error: "User not found" });
        }

        return res.status(HTTP_STATUS_CODES.OK).json({
            id: user._id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role,
            roleName: user.roleId?.name || 'user',
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        });
    } catch (error) {
        console.error("Error fetching current user:", error);
        
        if (error.name === "CastError") {
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ error: "Invalid user ID format" });
        }
        
        return res
            .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
            .json({ error: "An error occurred while fetching user details" });
    }
};

// Update user profile
const updateProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const updates = req.body;

        if (!userId) {
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ error: "User ID not found" });
        }

        // Remove password from updates if present
        delete updates.password;
        
        // Find and update user
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res
                .status(HTTP_STATUS_CODES.NOT_FOUND)
                .json({ error: "User not found" });
        }

        return res.status(HTTP_STATUS_CODES.OK).json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res
                .status(HTTP_STATUS_CODES.BAD_REQUEST)
                .json({ error: `${field} already exists` });
        }
        
        return res
            .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
            .json({ error: "An error occurred while updating profile" });
    }
};
// Forgot Password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Email is required'
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            // Return success even if user not found (security)
            return res.status(HTTP_STATUS_CODES.OK).json({
                message: 'If a user with that email exists, a reset link has been sent'
            });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET_KEY + user.password, // Add password to secret for uniqueness
            { expiresIn: '15m' }
        );

        // In production: Send email with reset link
        console.log(`Password reset token for ${email}: ${resetToken}`);
        
        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Password reset instructions sent',
            resetToken: resetToken // Remove in production, send via email instead
        });
    } catch (error) {
        console.error('Error in forgot password:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'An error occurred'
        });
    }
};

// Reset Password
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Token and new password are required'
            });
        }

        // Find user by decoding token
        const decoded = jwt.decode(token);
        const user = await User.findById(decoded.userId).select('+password');
        
        if (!user) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: 'User not found'
            });
        }

        // Verify token
        jwt.verify(token, process.env.JWT_SECRET_KEY + user.password);
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('Error in reset password:', error);
        if (error.name === 'TokenExpiredError') {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Reset token has expired'
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Invalid reset token'
            });
        }
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'An error occurred'
        });
    }
};

// Change Password (authenticated)
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.userId;
        
        if (!currentPassword || !newPassword) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: 'Current password and new password are required'
            });
        }

        const user = await User.findById(userId).select('+password');
        
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

        // Update password
        user.password = newPassword;
        await user.save();
        
        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'An error occurred'
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    updateProfile,
    forgotPassword,
    resetPassword,
    changePassword
};