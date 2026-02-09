const { Op } = require('sequelize');
const { User, Role } = require('../models');
const { asyncWrapper, HTTP_STATUS_CODES } = require('../middleware/index');

const createUser = async (req, res) => {
    try {
        const { name, username, email, password, roleId } = req.body;

        if (!name || !username || !email || !password || !roleId) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: "All fields are required"
            });
        }

        // Check if user exists
        const exists = await User.findOne({
            where: { email }
        });

        if (exists) {
            return res.status(HTTP_STATUS_CODES.CONFLICT).json({
                message: "User already exists"
            });
        }

        // Check if role exists
        const role = await Role.findByPk(roleId);
        if (!role) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                message: "Invalid role ID"
            });
        }

        const user = await User.create({
            name,
            username,
            email,
            password,
            roleId,
            role: role.name
        });

        // Remove password from response
        const userResponse = user.toJSON ? user.toJSON() : { ...user.get() };
        delete userResponse.password;

        return res.status(HTTP_STATUS_CODES.CREATED).json({ user: userResponse });
    } catch (error) {
        console.error("Error creating user:", error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(HTTP_STATUS_CODES.CONFLICT).json({
                message: "User with this email or username already exists"
            });
        }
        
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: error.message
        });
    }
};

const getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'createdAt', order = 'DESC' } = req.query;

        const { count, rows: users } = await User.findAndCountAll({
            where: {},
            order: [[sort, order]],
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
            attributes: { exclude: ['password'] },
            include: [
                { model: Role, as: 'userRole', attributes: ['id', 'name', 'description'] }
            ]
        });

        if (count === 0) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                message: "No users found"
            });
        }

        const formattedUsers = users.map(user => {
            const userData = user.toJSON ? user.toJSON() : user.get();
            if (userData.userRole && userData.userRole.dataValues) {
                userData.userRole = userData.userRole.dataValues;
            }
            return userData;
        });

        return res.status(HTTP_STATUS_CODES.OK).json({
            users: formattedUsers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / parseInt(limit)),
                totalUsers: count
            }
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: error.message
        });
    }
};

const getSingleUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [
                { model: Role, as: 'userRole', attributes: ['id', 'name', 'description'] }
            ]
        });

        if (!user) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                message: "User not found"
            });
        }

        const userResponse = user.toJSON ? user.toJSON() : user.get();
        if (userResponse.userRole && userResponse.userRole.dataValues) {
            userResponse.userRole = userResponse.userRole.dataValues;
        }

        return res.status(HTTP_STATUS_CODES.OK).json({ user: userResponse });
    } catch (error) {
        console.error("Error fetching user:", error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: error.message
        });
    }
};

const updateUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const userData = req.body;

        // Remove password from updates if present
        if (userData.password) {
            delete userData.password;
        }

        // Check if user exists
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                message: "User not found"
            });
        }

        // Update user
        await User.update(userData, {
            where: { id: userId },
            individualHooks: true
        });

        // Fetch updated user
        const updatedUser = await User.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [
                { model: Role, as: 'userRole', attributes: ['id', 'name', 'description'] }
            ]
        });

        const userResponse = updatedUser.toJSON ? updatedUser.toJSON() : updatedUser.get();
        if (userResponse.userRole && userResponse.userRole.dataValues) {
            userResponse.userRole = userResponse.userRole.dataValues;
        }

        return res.status(HTTP_STATUS_CODES.OK).json({ user: userResponse });
    } catch (error) {
        console.error("Error updating user:", error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(HTTP_STATUS_CODES.CONFLICT).json({
                message: "User with this email or username already exists"
            });
        }
        
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: error.message
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        const user = await User.destroy({
            where: { id: userId }
        });

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

