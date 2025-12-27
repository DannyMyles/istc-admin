const Role = require("../models/roleModel");
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
            permissions 
        });
        
        return res.status(HTTP_STATUS_CODES.CREATED).json(newRole);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ errors });
        }
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
            error: error.message 
        });
    }
};

const getAllRoles = async (req, res) => {
    try {
        const roles = await Role.find({})
            .sort({ createdAt: -1 });
        
        return res.status(HTTP_STATUS_CODES.OK).json(roles);
    } catch (error) {
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
            error: error.message 
        });
    }
};

const getRoleById = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        
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
        const role = await Role.findById(req.params.id);
        
        if (!role) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
                error: "Role not found" 
            });
        }

        const { name, description, permissions } = req.body;
        
        // Update only provided fields
        if (name) role.name = name;
        if (description !== undefined) role.description = description;
        if (permissions !== undefined) role.permissions = permissions;
        
        await role.save();
        
        return res.status(HTTP_STATUS_CODES.OK).json(role);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ errors });
        }
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
            error: error.message 
        });
    }
};

const deleteRole = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        
        if (!role) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
                error: "Role not found" 
            });
        }
        
        await role.deleteOne();
        
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