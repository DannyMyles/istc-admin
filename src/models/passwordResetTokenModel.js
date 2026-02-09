const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../db/connect');

const PasswordResetToken = sequelize.define('PasswordResetToken', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    token: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    isUsed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    ipAddress: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true
    }
}, {
    tableName: 'password_reset_tokens',
    indexes: [
        {
            fields: ['token', 'user_id']
        },
        {
            fields: ['expires_at']
        }
    ],
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false
});

// Set TTL index for auto-expiration (handled at application level for MySQL)
PasswordResetToken.isValidToken = async function(token) {
    const tokenDoc = await this.findOne({
        where: {
            token,
            expiresAt: { [Op.gt]: new Date() },
            isUsed: false
        }
    });
    return !!tokenDoc;
};

module.exports = PasswordResetToken;

