const User = require("../models/userModel");
const { asyncWrapper, HTTP_STATUS_CODES } = require("../middleware/index");

const createUser = async (req, res) => {
    try {
        const { name, username, email, password, roleId } = req.body;
        
        if (!name || !username || !email || !password || !roleId) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
                message: "All fields are required" 
            });
        }

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(HTTP_STATUS_CODES.CONFLICT).json({ 
                message: "User already exists" 
            });
        }

        const user = new User({ name, username, email, password, roleId });
        const savedUser = await user.save();
        
        // Remove password from response
        const userResponse = savedUser.toObject();
        delete userResponse.password;
        
        return res.status(HTTP_STATUS_CODES.CREATED).json({ user: userResponse });
    } catch (error) {
        console.error("Error creating user:", error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
            error: error.message 
        });
    }
};

const getUsers = async (req, res) => {
    try {
        const users = await User.find({})
            .select('-password')
            .sort({ createdAt: -1 })
            .populate('roleId', 'name');

        if (users.length === 0) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
                message: "No users found" 
            });
        }
        
        return res.status(HTTP_STATUS_CODES.OK).json({ users });
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
            error: error.message 
        });
    }
};

const getSingleUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId)
            .select('-password')
            .populate('roleId', 'name');

        if (!user) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
                message: "User not found" 
            });
        }
        
        return res.status(HTTP_STATUS_CODES.OK).json({ user });
    } catch (error) {
        console.error("Error fetching user:", error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
            error: error.message 
        });
    }
};

const updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const userData = req.body;

        // Remove password from updates if present
        if (userData.password) {
            delete userData.password;
        }

        const user = await User.findByIdAndUpdate(
            userId, 
            userData, 
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
                message: "User not found" 
            });
        }

        return res.status(HTTP_STATUS_CODES.OK).json({ user });
    } catch (error) {
        console.error("Error updating user:", error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
            error: error.message 
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findByIdAndDelete(userId);
        
        if (!user) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
                message: "User not found" 
            });
        }
        
        return res.status(HTTP_STATUS_CODES.OK).json({ 
            message: `User with ID ${userId} deleted successfully` 
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
            error: error.message 
        });
    }
};

module.exports = {
    createUser,
    getUsers,
    getSingleUser,
    updateUser,
    deleteUser,
};