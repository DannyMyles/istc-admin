const { Role } = require("../models");
const { asyncWrapper, HTTP_STATUS_CODES } = require("../middleware/index");

const createRole = async (req, res) => {
    try {
        const { name, description, permissions } = req.body;

        if (!name) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: "Role name is required"
            });
        }

        const newRole = await Role.create({
            name,
            description,
            permissions: permissions || []
        });

        return res.status(HTTP_STATUS_CODES.CREATED).json({
            id: newRole.id,
            name: newRole.name,
            description: newRole.description,
            permissions: newRole.permissions,
            isActive: newRole.isActive,
            isDefault: newRole.isDefault,
            createdAt: newRole.createdAt
        });
    } catch (error) {
        if (error.name === 'SequelizeValidationError') {
            const errors = error.errors.map(err => err.message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ errors });
        }
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(HTTP_STATUS_CODES.CONFLICT).json({
                error: 'Role with this name already exists'
            });
        }
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: error.message
        });
    }
};

const getAllRoles = async (req, res) => {
    try {
        const roles = await Role.findAll({
            order: [['createdAt', 'DESC']]
        });

        return res.status(HTTP_STATUS_CODES.OK).json(roles);
    } catch (error) {
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: error.message
        });
    }
};

const getRoleById = async (req, res) => {
    try {
        const roleId = parseInt(req.params.id);
        const role = await Role.findByPk(roleId);

        if (!role) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: "Role not found"
            });
        }

        return res.status(HTTP_STATUS_CODES.OK).json(role);
    } catch (error) {
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: error.message
        });
    }
};

const updateRole = async (req, res) => {
    try {
        const roleId = parseInt(req.params.id);
        const role = await Role.findByPk(roleId);

        if (!role) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: "Role not found"
            });
        }

        const { name, description, permissions, isActive } = req.body;

        // Update only provided fields
        if (name) role.name = name;
        if (description !== undefined) role.description = description;
        if (permissions !== undefined) role.permissions = permissions;
        if (isActive !== undefined) role.isActive = isActive;

        await role.save();

        return res.status(HTTP_STATUS_CODES.OK).json(role);
    } catch (error) {
        if (error.name === 'SequelizeValidationError') {
            const errors = error.errors.map(err => err.message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ errors });
        }
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(HTTP_STATUS_CODES.CONFLICT).json({
                error: 'Role with this name already exists'
            });
        }
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: error.message
        });
    }
};

const deleteRole = async (req, res) => {
    try {
        const roleId = parseInt(req.params.id);
        const role = await Role.findByPk(roleId);

        if (!role) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: "Role not found"
            });
        }

        await role.destroy();

        return res.status(HTTP_STATUS_CODES.OK).json({
            message: "Role deleted successfully"
        });
    } catch (error) {
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: error.message
        });
    }
};

module.exports = {
    createRole,
    getAllRoles,
    getRoleById,
    updateRole,
    deleteRole,
};

