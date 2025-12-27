const Blog = require('../models/blogModel');
const HTTP_STATUS_CODES = require('../utils/statusCodes');

// Create a new blog
const createBlog = async (req, res) => {
  try {
    const { 
      title, 
      excerpt, 
      content, 
      category, 
      author, 
      image, 
      readTime, 
      featured,
      tags,
      metaTitle,
      metaDescription 
    } = req.body;

    // Required fields validation
    if (!title || !excerpt || !content || !category || !author) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'Title, excerpt, content, category, and author are required'
      });
    }

    // Create blog
    const blog = new Blog({
      title,
      excerpt,
      content,
      category,
      author,
      authorId: req.userId, // From authentication middleware
      image: image || 'https://via.placeholder.com/800x400',
      readTime: readTime || '5 min read',
      featured: featured || false,
      tags: tags || [],
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || excerpt
    });

    await blog.save();

    return res.status(HTTP_STATUS_CODES.CREATED).json({
      message: 'Blog created successfully',
      blog: {
        id: blog._id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        category: blog.category,
        author: blog.author,
        image: blog.image,
        readTime: blog.readTime,
        featured: blog.featured,
        createdAt: blog.formattedDate
      }
    });
  } catch (error) {
    console.error('Error creating blog:', error);
    
    if (error.code === 11000) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'A blog with similar title already exists'
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ error: errors.join(', ') });
    }
    
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while creating the blog'
    });
  }
};

// Get all blogs
const getAllBlogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      featured, 
      search,
      sort = '-createdAt' 
    } = req.query;
    
    const query = { published: true };
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter by featured
    if (featured !== undefined) {
      query.featured = featured === 'true';
    }
    
    // Search functionality
    if (search) {
      query.$text = { $search: search };
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .select('-content -__v')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Blog.countDocuments(query)
    ]);
    
    const formattedBlogs = blogs.map(blog => ({
      id: blog._id,
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt,
      category: blog.category,
      author: blog.author,
      date: blog.formattedDate,
      readTime: blog.readTime,
      image: blog.image,
      featured: blog.featured,
      views: blog.views,
      likes: blog.likes,
      tags: blog.tags
    }));
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      blogs: formattedBlogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalBlogs: total,
        hasNextPage: skip + blogs.length < total,
        hasPrevPage: page > 1
      }
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
    
    const blog = await Blog.findOneAndUpdate(
      { slug },
      { $inc: { views: 1 } },
      { new: true }
    ).populate('authorId', 'name email');
    
    if (!blog) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Blog not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      blog: {
        id: blog._id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        content: blog.content,
        category: blog.category,
        tags: blog.tags,
        author: blog.author,
        authorDetails: blog.authorId,
        date: blog.formattedDate,
        readTime: blog.readTime,
        image: blog.image,
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
    
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Blog not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      blog: {
        id: blog._id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        content: blog.content,
        category: blog.category,
        tags: blog.tags,
        author: blog.author,
        date: blog.formattedDate,
        readTime: blog.readTime,
        image: blog.image,
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

// Update blog
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Find and update blog
    const blog = await Blog.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!blog) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Blog not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Blog updated successfully',
      blog: {
        id: blog._id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        category: blog.category,
        author: blog.author,
        date: blog.formattedDate,
        readTime: blog.readTime,
        image: blog.image,
        featured: blog.featured
      }
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ error: errors.join(', ') });
    }
    
    if (error.code === 11000) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'A blog with similar title already exists'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while updating the blog'
    });
  }
};

// Delete blog
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findByIdAndDelete(id);
    
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

// Get featured blogs
const getFeaturedBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find({ 
      featured: true, 
      published: true 
    })
    .select('-content -__v')
    .sort('-createdAt')
    .limit(5);
    
    const formattedBlogs = blogs.map(blog => ({
      id: blog._id,
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt,
      category: blog.category,
      author: blog.author,
      date: blog.formattedDate,
      readTime: blog.readTime,
      image: blog.image,
      featured: blog.featured
    }));
    
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
    const categories = await Blog.aggregate([
      { $match: { published: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      categories: categories.map(cat => ({
        name: cat._id,
        count: cat.count
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
    
    const blog = await Blog.findByIdAndUpdate(
      id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    
    if (!blog) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Blog not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Blog liked successfully',
      likes: blog.likes
    });
  } catch (error) {
    console.error('Error liking blog:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while liking the blog'
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
  likeBlog
};