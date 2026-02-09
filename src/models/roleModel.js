const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');

const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            isIn: {
                args: [['admin', 'user', 'editor', 'viewer', 'manager', 'supervisor']],
                msg: 'Invalid role name'
            }
        }
    },
    description: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    permissions: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    isDefault: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'roles',
    indexes: [
        {
            unique: true,
            fields: ['name']
        }
    ]
});

// Class methods
Role.getDefaultRole = async function() {
    return await this.findOne({ where: { name: 'user', isDefault: true } }) || 
           await this.findOne({ where: { name: 'user' } });
};

Role.findByName = async function(name) {
    return await this.findOne({ where: { name } });
};

module.exports = Role;