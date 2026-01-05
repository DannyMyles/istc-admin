const Blog = require('../models/blogModel');
const HTTP_STATUS_CODES = require('../utils/statusCodes');

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
        data: req.file.buffer,
        contentType: req.file.mimetype,
        filename: req.file.originalname,
        size: req.file.size
      };
      blogData.imageUrl = null; // Important
    } else if (imageUrl) {
      blogData.imageUrl = imageUrl;
    } else {
      blogData.imageUrl = 'https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0';
    }

    const blog = new Blog(blogData);
    await blog.save();

    return res.status(201).json({
      message: 'Blog created successfully',
      blog: {
        id: blog._id,
        title: blog.title,
        slug: blog.slug,
        excerpt: blog.excerpt,
        category: blog.category,
        author: blog.author,
        date: blog.formattedDate,
        readTime: blog.readTime,
        image: blog.imageUrlFormatted,
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
    
    const blog = await Blog.findById(id).select('image.data image.contentType');
    
    if (!blog || !blog.image || !blog.image.data) {
      // Return placeholder if no image
      return res.redirect('https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0');
    }
    
    // Set content type and send image buffer
    res.set('Content-Type', blog.image.contentType);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.send(blog.image.data);
  } catch (error) {
    console.error('Error fetching blog image:', error);
    // Redirect to placeholder on error
    res.redirect('https://cdn.dribbble.com/userupload/41784969/file/still-f9b1bc8254d3e952592927149caef80f.gif?resize=400x0');
  }
};

// Get blog image with details
const getBlogImageWithInfo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findById(id).select('image.data image.contentType image.filename image.size');
    
    if (!blog || !blog.image || !blog.image.data) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Image not found'
      });
    }
    
    // Send image info and base64 encoded image
    const imageBase64 = blog.image.data.toString('base64');
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      image: {
        contentType: blog.image.contentType,
        filename: blog.image.filename,
        size: blog.image.size,
        base64: `data:${blog.image.contentType};base64,${imageBase64}`,
        url: `/api/v1/blogs/${id}/image`
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
    const existingBlog = await Blog.findById(id);
    
    if (!existingBlog) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Blog not found'
      });
    }

    // Prepare updates
    const updates = { ...req.body };
    
    // Handle new file upload
    if (req.file) {
      // File validation is already done by multer, but double-check
      if (req.file.size > 16 * 1024 * 1024) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          error: 'Image size exceeds 16MB limit'
        });
      }
      
      updates.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        filename: req.file.originalname,
        size: req.file.size
      };
      // Clear imageUrl if uploading new image
      updates.imageUrl = null;
    }
    
    // If imageUrl is provided and no file uploaded, clear stored image
    if (req.body.imageUrl && !req.file) {
      updates.image = {
        data: null,
        contentType: null,
        filename: null,
        size: 0
      };
    }

    // Find and update blog
    const blog = await Blog.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

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
        image: blog.imageUrlFormatted,
        imageInfo: blog.getImageInfo(),
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

// Delete blog with image cleanup
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

// Update getAllBlogs to include image info
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
    
    if (category) query.category = category;
    if (featured !== undefined) query.featured = featured === 'true';
    if (search) query.$text = { $search: search };
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .select('-content -__v') // REMOVED -image.data from here
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
      image: blog.imageUrlFormatted,
      imageInfo: blog.getImageInfo(),
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
    
    // Convert blog to object and remove image buffer
    const blogObject = blog.toObject();
    if (blogObject.image && blogObject.image.data) {
      blogObject.image.hasBuffer = true;
      delete blogObject.image.data;
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
        image: blog.imageUrlFormatted,
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
        image: blog.imageUrlFormatted,
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
      image: blog.imageUrlFormatted,
      imageInfo: blog.getImageInfo(),
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

// Get blog statistics
const getBlogStats = async (req, res) => {
  try {
    const stats = await Blog.aggregate([
      {
        $group: {
          _id: null,
          totalBlogs: { $sum: 1 },
          blogsWithImages: {
            $sum: {
              $cond: [
                { $and: [
                  { $gt: ['$image.size', 0] },
                  { $ne: ['$image.data', null] }
                ]}, 
                1, 
                0
              ]
            }
          },
          totalImageSize: {
            $sum: {
              $cond: ['$image.size', '$image.size', 0]
            }
          },
          avgImageSize: {
            $avg: {
              $cond: [{ $gt: ['$image.size', 0] }, '$image.size', null]
            }
          },
          maxImageSize: {
            $max: '$image.size'
          }
        }
      }
    ]);
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      stats: stats[0] || {
        totalBlogs: 0,
        blogsWithImages: 0,
        totalImageSize: 0,
        avgImageSize: 0,
        maxImageSize: 0
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