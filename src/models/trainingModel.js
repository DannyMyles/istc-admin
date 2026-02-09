const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../db/connect');

const Training = sequelize.define('Training', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING(200),
        allowNull: false,
        unique: true,
        validate: {
            len: {
                args: [1, 200],
                msg: 'Title cannot be more than 200 characters'
            }
        }
    },
    slug: {
        type: DataTypes.STRING(220),
        allowNull: true,
        unique: true
    },
    code: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    targetGroup: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    duration: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            value: 1,
            unit: 'days',
            display: '1 day'
        }
    },
    cost: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            amount: 0,
            currency: 'KSH',
            display: 'KSH 0',
            taxInclusive: false
        }
    },
    sessions: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    category: {
        type: DataTypes.ENUM(
            'safety',
            'health',
            'first-aid',
            'construction',
            'fire-safety',
            'chemical',
            'general',
            'environmental',
            'management',
            'technical'
        ),
        defaultValue: 'safety'
    },
    modeOfStudy: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: ['full-time']
    },
    prerequisites: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    learningOutcomes: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    certification: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 'Certificate of Completion'
    },
    isFeatured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    registrationFee: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 1000
    },
    requirements: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
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
    tableName: 'trainings',
    indexes: [
        {
            unique: true,
            fields: ['title']
        },
        {
            unique: true,
            fields: ['slug']
        },
        {
            unique: true,
            fields: ['code']
        },
        {
            fields: ['category']
        },
        {
            fields: ['is_featured']
        },
        {
            fields: ['is_active']
        }
    ],
    hooks: {
        beforeCreate: async (training) => {
            // Generate slug from title
            if (training.title && !training.slug) {
                training.slug = training.title
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim();
            }
            
            // Generate unique code if it doesn't exist
            if (!training.code && training.title) {
                const { Training: TrainingModel } = require('../models');
                
                // Get first letters of words (max 3)
                const words = training.title.split(' ');
                let prefix = '';
                
                if (words.length >= 2) {
                    prefix = words
                        .map((word) => word.charAt(0).toUpperCase())
                        .join('')
                        .slice(0, 3);
                } else {
                    prefix = training.title.substring(0, 3).toUpperCase();
                }
                
                // Clean prefix (remove special characters)
                prefix = prefix.replace(/[^A-Z]/g, '');
                
                // If prefix is empty, use generic
                if (!prefix) prefix = 'TRN';
                
                // Find existing codes with same prefix
                const existing = await TrainingModel.findAll({
                    where: {
                        code: { [Op.like]: `${prefix}-%` }
                    }
                });
                
                // Generate next sequential number
                const nextNum = existing.length + 1;
                training.code = `${prefix}-${nextNum.toString().padStart(3, '0')}`;
            }
        },
        beforeUpdate: async (training) => {
            if (training.changed('title')) {
                training.slug = training.title
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim();
            }
        }
    }
});

// Instance methods
Training.prototype.formatDate = function(date) {
    if (!date) return '';
    const day = date.getDate();
    const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
    const month = date.toLocaleString('en-US', { month: 'long' });
    return `${day}${suffix} ${month}`;
};

Training.prototype.formattedSessions = function() {
    if (!this.sessions || !Array.isArray(this.sessions)) return [];
    
    return this.sessions.map((session) => ({
        ...session,
        formattedDates: `${this.formatDate(new Date(session.startDate))} - ${this.formatDate(new Date(session.endDate))}`,
        durationInDays: Math.ceil((new Date(session.endDate) - new Date(session.startDate)) / (1000 * 60 * 60 * 24)) + 1
    }));
};

Training.prototype.updateSeats = function(sessionIndex, bookedChange) {
    if (this.sessions && this.sessions[sessionIndex]) {
        this.sessions[sessionIndex].booked = (this.sessions[sessionIndex].booked || 0) + bookedChange;
        this.sessions[sessionIndex].available = (this.sessions[sessionIndex].total || 20) - this.sessions[sessionIndex].booked;
    }
};

// Class methods
Training.findBySlug = async function(slug) {
    return await this.findOne({ where: { slug } });
};

Training.findByCode = async function(code) {
    return await this.findOne({ where: { code } });
};

Training.findFeatured = async function(limit = 5) {
    return await this.findAll({
        where: {
            isFeatured: true,
            isActive: true
        },
        order: [['createdAt', 'DESC']],
        limit
    });
};

Training.findActive = async function(query = {}, options = {}) {
    const { 
        page = 1, 
        limit = 10, 
        order = [['createdAt', 'DESC']]
    } = options;
    
    const where = { isActive: true, ...query };
    const offset = (page - 1) * limit;
    
    const { count, rows } = await this.findAndCountAll({
        where,
        order,
        limit,
        offset
    });
    
    return { count, rows };
};

module.exports = Training;

