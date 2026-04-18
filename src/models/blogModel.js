const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../db/connect');
const path = require('path');
const fs = require('fs');

const Blog = sequelize.define('Blog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING(200),
        allowNull: false,
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
    excerpt: {
        type: DataTypes.STRING(300),
        allowNull: false,
        validate: {
            len: {
                args: [1, 300],
                msg: 'Excerpt cannot be more than 300 characters'
            }
        }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    category: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    author: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    authorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    image: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null
    },
    imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0'
    },
    readTime: {
        type: DataTypes.STRING(50),
        defaultValue: '5 min read'
    },
    featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    published: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    views: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    likes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    metaTitle: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    metaDescription: {
        type: DataTypes.STRING(160),
        allowNull: true,
        validate: {
            len: {
                args: [0, 160],
                msg: 'Meta description cannot be more than 160 characters'
            }
        }
    }
}, {
    tableName: 'blogs',
    indexes: [
        {
            unique: true,
            fields: ['slug']
        },
        {
            fields: ['published', 'featured', 'category']
        },
        {
            fields: ['created_at']
        }
    ],
    hooks: {
        beforeCreate: (blog) => {
            if (blog.title) {
                blog.slug = blog.title
                    .toLowerCase()
                    .replace(/[^\\w\\s]/gi, '')
                    .replace(/\\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim();
            }
        },
        beforeUpdate: (blog) => {
            if (blog.changed('title')) {
                blog.slug = blog.title
                    .toLowerCase()
                    .replace(/[^\\w\\s]/gi, '')
                    .replace(/\\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim();
            }
        }
    }
});

// Virtual properties and helpers - UPDATED FOR FILESYSTEM STORAGE
Blog.prototype.getImageObject = function() {
    if (!this.image) return null;

    if (Buffer.isBuffer(this.image)) {
        try {
            return JSON.parse(this.image.toString('utf8'));
        } catch (err) {
            console.warn('Failed to parse image buffer:', err.message);
            return null;
        }
    }

    if (typeof this.image === 'string') {
        try {
            return JSON.parse(this.image);
        } catch (err) {
            console.warn('Failed to parse image string:', err.message);
            return null;
        }
    }

    return this.image;
};

Blog.prototype.hasUploadedImage = function() {
    const image = this.getImageObject();
    return !!(image && image.filename && image.size && image.size > 0);
};

Blog.prototype.getImagePath = function() {
    const image = this.getImageObject();
    if (image && image.filename) {
        return path.join('src/uploads', image.filename);
    }
    return null;
};

Blog.prototype.imageUrlFormatted = function(baseUrl = '/uploads') {
    const image = this.getImageObject();
    if (image && image.filename) {
        return `${baseUrl}/${image.filename}`;
    }
    
    if (this.imageUrl && 
        this.imageUrl !== 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0') {
        return this.imageUrl;
    }
    
    return 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0';
};

Blog.prototype.getImageInfo = function(baseUrl = '/uploads') {
    const image = this.getImageObject();

    if (image && image.filename) {
        const fullPath = path.join(__dirname, '..', 'uploads', image.filename);
        const stats = fs.existsSync(fullPath) ? fs.statSync(fullPath) : null;
        
        return {
            hasImage: true,
            filename: image.filename,
            relativePath: this.getImagePath(),
            url: this.imageUrlFormatted(baseUrl),
            contentType: image.contentType || 'image/jpeg',
            size: image.size || 0,
            fileSize: stats ? stats.size : image.size,
            type: 'uploaded'
        };
    }
    
    if (this.imageUrl && 
        this.imageUrl !== 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0') {
        return {
            hasImage: true,
            type: 'external',
            url: this.imageUrl
        };
    }
    
    return {
        hasImage: false,
        url: 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0'
    };
};

Blog.prototype.formattedDate = function() {
    if (!this.createdAt) return '';
    const date = new Date(this.createdAt);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// Class methods
Blog.findBySlug = async function(slug) {
    return await this.findOne({ where: { slug } });
};

Blog.findPublished = async function(query = {}, options = {}) {
    const { 
        page = 1, 
        limit = 10, 
        order = [['createdAt', 'DESC']]
    } = options;
    
    const where = { published: true, ...query };
    const offset = (page - 1) * limit;
    
    const { count, rows } = await this.findAndCountAll({
        where,
        order,
        limit,
        offset,
        attributes: { exclude: ['content', 'image'] } // Exclude large fields
    });
    
    return { count, rows };
};

module.exports = Blog;
