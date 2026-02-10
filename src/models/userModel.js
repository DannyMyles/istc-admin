const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../db/connect');

const User = sequelize.define('User', {
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
                msg: 'Name cannot be more than 100 characters'
            }
        }
    },
    username: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
        validate: {
            len: {
                args: [3, 30],
                msg: 'Username must be between 3 and 30 characters'
            },
            isAlphanumeric: {
                msg: 'Username must be alphanumeric'
            }
        }
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: {
                msg: 'Please provide a valid email'
            }
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            len: {
                args: [6, 255],
                msg: 'Password must be at least 6 characters'
            }
        }
    },
    role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'user',
        validate: {
            isIn: {
                args: [['admin', 'user', 'editor', 'viewer']],
                msg: 'Invalid role'
            }
        }
    },
    roleId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    lastLogin: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'users',
    indexes: [
        {
            unique: true,
            fields: ['email']
        },
        {
            unique: true,
            fields: ['username']
        },
        {
            // Single composite index for role-based queries
            fields: ['role_id', 'is_active']
        }
    ],
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Instance methods
User.prototype.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.password;
    return values;
};

// Class methods
User.findByEmail = async function(email) {
    return await this.findOne({ where: { email } });
};

User.findByUsername = async function(username) {
    return await this.findOne({ where: { username } });
};

User.getAllUsers = async function(options = {}) {
    const { 
        page = 1, 
        limit = 10, 
        order = [['createdAt', 'DESC']],
        where = {}
    } = options;
    
    const offset = (page - 1) * limit;
    
    const { count, rows } = await this.findAndCountAll({
        where,
        order,
        limit,
        offset,
        attributes: { exclude: ['password'] },
        include: [
            {
                model: require('./roleModel'),
                as: 'userRole',
                attributes: ['id', 'name', 'description']
            }
        ]
    });
    
    return { count, rows };
};

module.exports = User;