const { Op } = require('sequelize');
const { Blog } = require('../models');
const HTTP_STATUS_CODES = require('../utils/statusCodes');
const fs = require('fs');
const path = require('path');

const createBlog = async (req, res) => {
  try {
    const {
      title,
      excerpt,
      content,
      category,
      author,
      readTime,
      featured,
      tags,
      metaTitle,
      metaDescription,
      imageUrl
    } = req.body;

    if (!title || !excerpt || !content || !category || !author) {
      return res.status(400).json({
        error: 'Title, excerpt, content, category, and author are required'
      });
    }

    const blogData = {
      title,
      excerpt,
      content,
      category,
      author,
      authorId: req.userId,
      readTime: readTime || '5 min read',
      featured: featured === 'true',
      tags: tags ? JSON.parse(tags) : [],
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || excerpt
    };

    if (req.file) {
      blogData.image = {
        filename: req.file.filename,
        relativePath: `/uploads/${req.file.filename}`,
        contentType: req.file.mimetype,
        size: req.file.size
      };
      blogData.imageUrl = null; // Clear URL for uploaded image
    } else if (imageUrl) {
      blogData.imageUrl = imageUrl;
    } else {
      blogData.imageUrl = 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0';
    }

    const blog = await Blog.create(blogData);

    return res.status(201).json({
      message: 'Blog created successfully',
      blog: {
        id: blog.id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        category: blog.category,
        author: blog.author,
        date: blog.formattedDate(),
        readTime: blog.readTime,
        image: blog.imageUrlFormatted(),
        imageInfo: blog.getImageInfo()
      }
    });
  } catch (error) {
    console.error('Error creating blog:', error);
    return res.status(500).json({ error: 'Failed to create blog' });
  }
};

// Get blog image (serve image buffer)
const getBlogImage = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByPk(id);

    if (!blog || !blog.hasUploadedImage()) {
      return res.redirect('https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0');
    }

    const image = blog.getImageObject();
    const imagePath = path.join(__dirname, '..', 'uploads', image.filename);

    if (!fs.existsSync(imagePath)) {
      console.warn(`Image file not found: ${imagePath}`);
      return res.redirect('https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0');
    }

    res.set('Content-Type', image.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Content-Disposition', 'inline');

    const readStream = fs.createReadStream(imagePath);
    readStream.pipe(res);

    readStream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.redirect('https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0');
      }
    });
  } catch (error) {
    console.error('Error fetching blog image:', error);
    res.redirect('https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0');
  }
};

// Get blog image with details
const getBlogImageWithInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByPk(id);

    if (!blog || !blog.hasUploadedImage()) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Image not found'
      });
    }

    const image = blog.getImageObject();
    const imagePath = path.join(__dirname, '..', 'uploads', image.filename);
    const stats = fs.existsSync(imagePath) ? fs.statSync(imagePath) : null;

    return res.status(HTTP_STATUS_CODES.OK).json({
      image: {
        filename: image.filename,
        contentType: image.contentType,
        size: image.size,
        fileSize: stats ? stats.size : 0,
        url: `/uploads/${image.filename}`,
        apiUrl: `/api/v1/blogs/${id}/image`,
        type: 'uploaded'
      }
    });
  } catch (error) {
    console.error('Error fetching blog image info:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching the image'
    });
  }
};

// Update blog with image
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Find existing blog
    const existingBlog = await Blog.findByPk(id);

    if (!existingBlog) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Blog not found'
      });
    }

    // Prepare updates
    const updates = { ...req.body };

    // Delete old image if exists and new file uploaded
    if (req.file && existingBlog.hasUploadedImage()) {
      const existingImage = existingBlog.getImageObject();
      const oldImagePath = path.join(__dirname, '..', 'uploads', existingImage.filename);
      fs.unlink(oldImagePath, (err) => {
        if (err) console.warn('Failed to delete old image:', err);
      });
    }

    // Handle new file upload
    if (req.file) {
      if (req.file.size > 16 * 1024 * 1024) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          error: 'Image size exceeds 16MB limit'
        });
      }

      updates.image = {
        filename: req.file.filename,
        relativePath: `/uploads/${req.file.filename}`,
        contentType: req.file.mimetype,
        size: req.file.size
      };
      updates.imageUrl = null;
    }

    // If imageUrl provided and no file, clear stored image data
    if (req.body.imageUrl && !req.file) {
      updates.image = null;
      updates.imageUrl = req.body.imageUrl;
    }

    // Find and update blog
    await Blog.update(updates, { where: { id }, individualHooks: true });

    const blog = await Blog.findByPk(id);

    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Blog updated successfully',
      blog: {
        id: blog.id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        category: blog.category,
        author: blog.author,
        date: blog.formattedDate(),
        readTime: blog.readTime,
        image: blog.imageUrlFormatted(),
        imageInfo: blog.getImageInfo(),
        featured: blog.featured
      }
    });
  } catch (error) {
    console.error('Error updating blog:', error);

    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ error: errors.join(', ') });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'A blog with similar title already exists'
      });
    }

    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while updating the blog'
    });
  }
};

// Delete blog with image cleanup
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.destroy({
      where: { id }
    });

    if (!blog) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Blog not found'
      });
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while deleting the blog'
    });
  }
};

// Update getAllBlogs to include image info
const getAllBlogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      featured,
      search,
      sort = 'createdAt',
      order = 'DESC'
    } = req.query;

    const query = { published: true };

    if (category) query.category = category;
    if (featured !== undefined) query.featured = featured === 'true';

    // For search, we'll use LIKE for MySQL
    if (search) {
      query[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { excerpt: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const orderArr = [[sort, order]];

    const { count, rows: blogs } = await Blog.findAndCountAll({
      where: query,
      order: orderArr,
      limit: parseInt(limit),
      offset
    });

    const formattedBlogs = blogs.map(blog => {
      // Ensure prototype chain for virtual methods
      if (!blog.imageUrlFormatted) {
        Object.setPrototypeOf(blog, require('../models/blogModel').prototype);
      }
      
      return {
        id: blog.id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        category: blog.category,
        author: blog.author,
        date: blog.formattedDate ? blog.formattedDate() : '',
        readTime: blog.readTime,
        image: blog.imageUrlFormatted('/uploads'),
        imageInfo: blog.getImageInfo('/uploads'),
        featured: blog.featured,
        views: blog.views,
        likes: blog.likes,
        tags: blog.tags
      };
    });

    const total = Number(count) || 0;
    return res.status(HTTP_STATUS_CODES.OK).json({
      blogs: formattedBlogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalBlogs: total,
        hasNextPage: offset + formattedBlogs.length < total,
        hasPrevPage: parseInt(page) > 1,
        totalCount: total  // Extra top-level for frontend compatibility
      },
      totalBlogs: total  // Direct top-level access for frontend fix
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching blogs'
    });
  }
};

// Get single blog by slug
const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const blog = await Blog.findOne({
      where: { slug }
    });

    if (!blog) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Blog not found'
      });
    }

    // Increment views
    await blog.increment('views');

    // No buffer to remove - filesystem based

    return res.status(HTTP_STATUS_CODES.OK).json({
      blog: {
        id: blog.id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        content: blog.content,
        category: blog.category,
        tags: blog.tags,
        author: blog.author,
        date: blog.formattedDate(),
        readTime: blog.readTime,
        image: blog.imageUrlFormatted(),
        imageInfo: blog.getImageInfo(),
        featured: blog.featured,
        views: blog.views,
        likes: blog.likes,
        metaTitle: blog.metaTitle,
        metaDescription: blog.metaDescription,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching the blog'
    });
  }
};

// Get blog by ID
const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByPk(id);

    if (!blog) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Blog not found'
      });
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      blog: {
        id: blog.id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        content: blog.content,
        category: blog.category,
        tags: blog.tags,
        author: blog.author,
        date: blog.formattedDate(),
        readTime: blog.readTime,
        image: blog.imageUrlFormatted(),
        imageInfo: blog.getImageInfo(),
        featured: blog.featured,
        views: blog.views,
        likes: blog.likes
      }
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching the blog'
    });
  }
};

// Get featured blogs
const getFeaturedBlogs = async (req, res) => {
  try {
    const blogs = await Blog.findAll({
      where: {
        featured: true,
        published: true
      },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    const formattedBlogs = blogs.map(blog => {
      if (!blog.imageUrlFormatted) {
        Object.setPrototypeOf(blog, require('../models/blogModel').prototype);
      }
      return {
        id: blog.id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        category: blog.category,
        author: blog.author,
        date: blog.formattedDate ? blog.formattedDate() : '',
        readTime: blog.readTime,
        image: blog.imageUrlFormatted('/uploads'),
        imageInfo: blog.getImageInfo('/uploads'),
        featured: blog.featured
      };
    });

    return res.status(HTTP_STATUS_CODES.OK).json({
      blogs: formattedBlogs
    });
  } catch (error) {
    console.error('Error fetching featured blogs:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching featured blogs'
    });
  }
};

// Get blog categories
const getBlogCategories = async (req, res) => {
  try {
    const categories = await Blog.findAll({
      where: { published: true },
      attributes: [
        'category',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['category'],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']]
    });

    return res.status(HTTP_STATUS_CODES.OK).json({
      categories: categories.map(cat => ({
        name: cat.category,
        count: parseInt(cat.get('count'))
      }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching categories'
    });
  }
};

// Like a blog
const likeBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByPk(id);

    if (!blog) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Blog not found'
      });
    }

    await blog.increment('likes');

    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Blog liked successfully',
      likes: blog.likes + 1
    });
  } catch (error) {
    console.error('Error liking blog:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while liking the blog'
    });
  }
};

// Get blog statistics
const getBlogStats = async (req, res) => {
  try {
    const { sequelize } = require('../models');
    
    const [results] = await sequelize.query(`
      SELECT 
        COUNT(*) as totalBlogs,
        SUM(CASE WHEN image IS NOT NULL AND JSON_EXTRACT(image, '$.filename') IS NOT NULL THEN 1 ELSE 0 END) as blogsWithImages,
        SUM(views) as totalViews,
        SUM(CASE WHEN image IS NOT NULL AND JSON_EXTRACT(image, '$.size') > 0 THEN JSON_EXTRACT(image, '$.size') ELSE 0 END) as totalImageSize,
        AVG(CASE WHEN image IS NOT NULL AND JSON_EXTRACT(image, '$.size') > 0 THEN JSON_EXTRACT(image, '$.size') ELSE NULL END) as avgImageSize,
        MAX(CASE WHEN image IS NOT NULL AND JSON_EXTRACT(image, '$.size') > 0 THEN JSON_EXTRACT(image, '$.size') ELSE NULL END) as maxImageSize
      FROM blogs
    `);

    const totalBlogs = parseInt(results[0]?.totalBlogs) || 0;
    return res.status(HTTP_STATUS_CODES.OK).json({
      totalBlogs,
      stats: {
        totalBlogs,
        blogsWithImages: parseInt(results[0]?.blogsWithImages) || 0,
        totalImageSize: parseInt(results[0]?.totalImageSize) || 0,
        avgImageSize: parseInt(results[0]?.avgImageSize) || 0,
        maxImageSize: parseInt(results[0]?.maxImageSize) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching blog stats:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching statistics'
    });
  }
};

module.exports = {
  createBlog,
  getAllBlogs,
  getBlogBySlug,
  getBlogById,
  updateBlog,
  deleteBlog,
  getFeaturedBlogs,
  getBlogCategories,
  likeBlog,
  getBlogImage,
  getBlogImageWithInfo,
  getBlogStats
};

