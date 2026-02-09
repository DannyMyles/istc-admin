const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');

const Contact = sequelize.define('Contact', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            len: {
                args: [1, 100],
                msg: 'Name cannot exceed 100 characters'
            }
        }
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            isEmail: {
                msg: 'Please provide a valid email'
            }
        }
    },
    subject: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
            len: {
                args: [1, 200],
                msg: 'Subject cannot exceed 200 characters'
            }
        }
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            len: {
                args: [1, 2000],
                msg: 'Message cannot exceed 2000 characters'
            }
        }
    },
    phone: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'read', 'replied', 'resolved', 'spam'),
        defaultValue: 'pending'
    },
    category: {
        type: DataTypes.ENUM('general', 'support', 'feedback', 'complaint', 'partnership', 'other'),
        defaultValue: 'general'
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium'
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    response: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null
    },
    isArchived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'contacts',
    indexes: [
        {
            fields: ['status', 'created_at']
        },
        {
            fields: ['email']
        },
        {
            fields: ['user_id']
        }
    ]
});

module.exports = Contact;

