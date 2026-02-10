const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');
const { asyncWrapper, HTTP_STATUS_CODES } = require('../middleware');

const Contact = require('../models/contactModel');

// ==================== GET ALL CONTACTS ====================
const getAllContacts = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, category, search, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;

        const where = {};
        
        // Filter by status
        if (status && status !== 'all') {
            where.status = status;
        }

        // Filter by category
        if (category && category !== 'all') {
            where.category = category;
        }

        // Search by name, email, subject, or message
        if (search) {
            where[DataTypes.Op.or] = [
                { name: { [DataTypes.Op.like]: `%${search}%` } },
                { email: { [DataTypes.Op.like]: `%${search}%` } },
                { subject: { [DataTypes.Op.like]: `%${search}%` } },
                { message: { [DataTypes.Op.like]: `%${search}%` } }
            ];
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows: contacts } = await Contact.findAndCountAll({
            where,
            order: [[sortBy, sortOrder]],
            limit: parseInt(limit),
            offset,
            attributes: { exclude: ['userId'] }
        });

        return res.status(HTTP_STATUS_CODES.OK).json({
            contacts,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / parseInt(limit)),
                totalContacts: count,
                hasNextPage: offset + contacts.length < count,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to fetch contacts'
        });
    }
};

// ==================== GET SINGLE CONTACT ====================
const getContactById = async (req, res) => {
    try {
        const { id } = req.params;

        const contact = await Contact.findByPk(id, {
            attributes: { exclude: ['userId'] }
        });

        if (!contact) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: 'Contact not found'
            });
        }

        return res.status(HTTP_STATUS_CODES.OK).json({
            contact
        });
    } catch (error) {
        console.error('Error fetching contact:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to fetch contact'
        });
    }
};

// ==================== UPDATE CONTACT STATUS ====================
const updateContactStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, response } = req.body;

        // Validate status
        const validStatuses = ['pending', 'read', 'replied', 'resolved', 'spam'];
        if (!validStatuses.includes(status)) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const contact = await Contact.findByPk(id);

        if (!contact) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: 'Contact not found'
            });
        }

        // Prepare update data
        const updateData = { status };

        // If response is provided, add response info
        if (response) {
            updateData.response = {
                message: response.message,
                repliedBy: req.userId || 'admin',
                repliedAt: new Date().toISOString()
            };
        }

        await contact.update(updateData);

        // Fetch updated contact
        const updatedContact = await Contact.findByPk(id, {
            attributes: { exclude: ['userId'] }
        });

        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Contact status updated successfully',
            contact: updatedContact
        });
    } catch (error) {
        console.error('Error updating contact status:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to update contact status'
        });
    }
};

// ==================== DELETE CONTACT ====================
const deleteContact = async (req, res) => {
    try {
        const { id } = req.params;

        const contact = await Contact.findByPk(id);

        if (!contact) {
            return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
                error: 'Contact not found'
            });
        }

        await contact.destroy();

        return res.status(HTTP_STATUS_CODES.OK).json({
            message: 'Contact deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting contact:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to delete contact'
        });
    }
};

// ==================== GET CONTACT STATS ====================
const getContactStats = async (req, res) => {
    try {
        const total = await Contact.count();
        const pending = await Contact.count({ where: { status: 'pending' } });
        const read = await Contact.count({ where: { status: 'read' } });
        const replied = await Contact.count({ where: { status: 'replied' } });
        const resolved = await Contact.count({ where: { status: 'resolved' } });
        const spam = await Contact.count({ where: { status: 'spam' } });

        const byCategory = await Contact.findAll({
            attributes: [
                'category',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['category']
        });

        return res.status(HTTP_STATUS_CODES.OK).json({
            stats: {
                total,
                byStatus: { pending, read, replied, resolved, spam },
                byCategory: byCategory.map(c => ({
                    category: c.category,
                    count: c.get('count')
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching contact stats:', error);
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to fetch contact statistics'
        });
    }
};

module.exports = {
    getAllContacts,
    getContactById,
    updateContactStatus,
    deleteContact,
    getContactStats
};

