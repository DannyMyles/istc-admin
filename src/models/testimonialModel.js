const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/connect');

const Testimonial = sequelize.define('Testimonial', {
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
    role: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
            len: {
                args: [1, 200],
                msg: 'Role cannot exceed 200 characters'
            }
        }
    },
    company: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            len: {
                args: [1, 1000],
                msg: 'Content cannot exceed 1000 characters'
            }
        }
    },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
        validate: {
            min: {
                args: [1],
                msg: 'Rating must be at least 1'
            },
            max: {
                args: [5],
                msg: 'Rating cannot exceed 5'
            }
        }
    },
    image: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null
    },
    avatarColor: {
        type: DataTypes.STRING(10),
        defaultValue: '#3b82f6',
        validate: {
            isHexColor: {
                msg: 'Must be a valid hex color'
            }
        }
    },
    featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    approved: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    trainingId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    trainingName: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
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
    tableName: 'testimonials',
    indexes: [
        {
            fields: ['featured', 'is_active']
        },
        {
            fields: ['rating']
        },
        {
            fields: ['training_id']
        },
        {
            fields: ['approved', 'is_active']
        }
    ],
    hooks: {
        beforeCreate: (testimonial) => {
            // Generate initials if no image provided
            if (!testimonial.image && testimonial.name) {
                const names = testimonial.name.split(' ');
                const initials = names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
                testimonial.image = initials || 'NA';
            }
            
            // Generate random avatar color if not provided
            if (!testimonial.avatarColor) {
                const colors = [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
                ];
                testimonial.avatarColor = colors[Math.floor(Math.random() * colors.length)];
            }
            
            // Extract company from role if company not provided
            if (!testimonial.company && testimonial.role && testimonial.role.includes(',')) {
                const parts = testimonial.role.split(',');
                if (parts.length > 1) {
                    testimonial.company = parts[1].trim();
                }
            }
        }
    }
});

// Instance methods
Testimonial.prototype.getInitials = function() {
    if (this.image) return this.image;
    
    const names = this.name.split(' ');
    return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Class methods
Testimonial.findFeatured = async function(limit = 5) {
    return await this.findAll({
        where: {
            featured: true,
            isActive: true
        },
        order: [['order', 'ASC'], ['createdAt', 'DESC']],
        limit
    });
};

Testimonial.findByTraining = async function(trainingId) {
    return await this.findAll({
        where: {
            trainingId,
            isActive: true
        },
        order: [['createdAt', 'DESC']]
    });
};

module.exports = Testimonial;

