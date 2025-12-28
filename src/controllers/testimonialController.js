const Testimonial = require('../models/testimonialModel');
const Training = require('../models/trainingModel');
const HTTP_STATUS_CODES = require('../utils/statusCodes');

// Helper function to format testimonial response
const formatTestimonialResponse = (testimonial) => {
  return {
    id: testimonial._id,
    name: testimonial.name,
    role: testimonial.role,
    company: testimonial.company || testimonial.role?.split(',')?.[1]?.trim(),
    content: testimonial.content,
    rating: testimonial.rating,
    image: testimonial.image || testimonial.initials,
    avatarColor: testimonial.avatarColor,
    featured: testimonial.featured,
    trainingId: testimonial.trainingId,
    trainingName: testimonial.trainingName,
    isActive: testimonial.isActive,
    createdAt: testimonial.createdAt,
    updatedAt: testimonial.updatedAt
  };
};

// Get all testimonials
const getAllTestimonials = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      featured,
      rating,
      trainingId,
      search,
      sort = '-createdAt'
    } = req.query;

    const query = { isActive: true, approved: true };

    // Filter by featured status
    if (featured !== undefined) {
      query.featured = featured === 'true';
    }

    // Filter by minimum rating
    if (rating) {
      query.rating = { $gte: parseInt(rating) };
    }

    // Filter by training
    if (trainingId) {
      query.trainingId = trainingId;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { trainingName: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [testimonials, total] = await Promise.all([
      Testimonial.find(query)
        .populate('trainingId', 'title code')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Testimonial.countDocuments(query)
    ]);

    return res.status(HTTP_STATUS_CODES.OK).json({
      testimonials: testimonials.map(formatTestimonialResponse),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalTestimonials: total,
        hasNextPage: skip + testimonials.length < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching testimonials'
    });
  }
};

// Get featured testimonials
const getFeaturedTestimonials = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const testimonials = await Testimonial.find({
      isActive: true,
      approved: true,
      featured: true
    })
      .populate('trainingId', 'title code')
      .sort('-rating -createdAt')
      .limit(parseInt(limit));

    return res.status(HTTP_STATUS_CODES.OK).json({
      testimonials: testimonials.map(formatTestimonialResponse)
    });
  } catch (error) {
    console.error('Error fetching featured testimonials:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching featured testimonials'
    });
  }
};

// Get testimonial by ID
const getTestimonialById = async (req, res) => {
  try {
    const { id } = req.params;

    const testimonial = await Testimonial.findById(id)
      .populate('trainingId', 'title code')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!testimonial || !testimonial.isActive) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Testimonial not found'
      });
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      testimonial: formatTestimonialResponse(testimonial)
    });
  } catch (error) {
    console.error('Error fetching testimonial:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching the testimonial'
    });
  }
};

// Create testimonial
const createTestimonial = async (req, res) => {
  try {
    const {
      name,
      role,
      company,
      content,
      rating,
      image,
      avatarColor,
      featured,
      trainingId,
      trainingName
    } = req.body;

    // Required fields validation
    if (!name || !role || !content || !rating) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'Name, role, content, and rating are required'
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'Rating must be between 1 and 5'
      });
    }

    // Validate training if provided
    if (trainingId) {
      const training = await Training.findById(trainingId);
      if (!training) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          error: 'Training course not found'
        });
      }
    }

    // Create testimonial
    const testimonial = new Testimonial({
      name,
      role,
      company,
      content,
      rating,
      image,
      avatarColor,
      featured: featured || false,
      trainingId,
      trainingName,
      createdBy: req.userId
    });

    await testimonial.save();

    return res.status(HTTP_STATUS_CODES.CREATED).json({
      message: 'Testimonial created successfully',
      testimonial: formatTestimonialResponse(testimonial)
    });
  } catch (error) {
    console.error('Error creating testimonial:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: errors.join(', ')
      });
    }
    
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while creating the testimonial'
    });
  }
};

// Update testimonial
const updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if testimonial exists
    const testimonial = await Testimonial.findById(id);
    if (!testimonial || !testimonial.isActive) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Testimonial not found'
      });
    }

    // Validate rating if provided
    if (updates.rating && (updates.rating < 1 || updates.rating > 5)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'Rating must be between 1 and 5'
      });
    }

    // Validate training if provided
    if (updates.trainingId) {
      const training = await Training.findById(updates.trainingId);
      if (!training) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          error: 'Training course not found'
        });
      }
    }

    // Update testimonial
    const updatedTestimonial = await Testimonial.findByIdAndUpdate(
      id,
      {
        $set: { ...updates, updatedBy: req.userId }
      },
      { new: true, runValidators: true }
    )
      .populate('trainingId', 'title code')
      .populate('updatedBy', 'name email');

    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Testimonial updated successfully',
      testimonial: formatTestimonialResponse(updatedTestimonial)
    });
  } catch (error) {
    console.error('Error updating testimonial:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: errors.join(', ')
      });
    }
    
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while updating the testimonial'
    });
  }
};

// Delete testimonial (soft delete)
const deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;

    const testimonial = await Testimonial.findByIdAndDelete(
      id,
      {
        isActive: false,
        updatedBy: req.userId
      },
      { new: true }
    );

    if (!testimonial) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Testimonial not found'
      });
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Testimonial deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while deleting the testimonial'
    });
  }
};

// Get statistics
const getTestimonialStatistics = async (req, res) => {
  try {
    const [
      totalTestimonials,
      featuredCount,
      averageRatingResult,
      ratingDistribution,
      recentTestimonials
    ] = await Promise.all([
      // Total testimonials
      Testimonial.countDocuments({ isActive: true, approved: true }),
      
      // Featured testimonials count
      Testimonial.countDocuments({ 
        isActive: true, 
        approved: true, 
        featured: true 
      }),
      
      // Average rating
      Testimonial.aggregate([
        { $match: { isActive: true, approved: true } },
        { $group: { _id: null, averageRating: { $avg: '$rating' } } }
      ]),
      
      // Rating distribution
      Testimonial.aggregate([
        { $match: { isActive: true, approved: true } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: -1 } }
      ]),
      
      // Recent testimonials (last 30 days)
      Testimonial.find({ 
        isActive: true, 
        approved: true,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
      .sort('-createdAt')
      .limit(5)
      .select('name role rating createdAt')
    ]);

    const averageRating = averageRatingResult[0]?.averageRating || 0;
    
    // Calculate rating distribution as percentages
    const total = ratingDistribution.reduce((sum, item) => sum + item.count, 0);
    const distribution = ratingDistribution.map(item => ({
      rating: item._id,
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
    }));

    // Get training-wise testimonials count
    const trainingStats = await Testimonial.aggregate([
      { $match: { isActive: true, approved: true, trainingId: { $ne: null } } },
      { $group: { _id: '$trainingId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Populate training names
    const populatedTrainingStats = await Promise.all(
      trainingStats.map(async (stat) => {
        const training = await Training.findById(stat._id).select('title code');
        return {
          trainingId: stat._id,
          trainingName: training?.title || 'Unknown Training',
          trainingCode: training?.code,
          testimonialCount: stat.count
        };
      })
    );

    return res.status(HTTP_STATUS_CODES.OK).json({
      statistics: {
        totalTestimonials,
        featuredCount,
        averageRating: parseFloat(averageRating.toFixed(1)),
        ratingDistribution: distribution,
        recentTestimonials: recentTestimonials.map(t => ({
          name: t.name,
          role: t.role,
          rating: t.rating,
          date: t.createdAt
        })),
        topTrainingWithTestimonials: populatedTrainingStats
      }
    });
  } catch (error) {
    console.error('Error fetching testimonial statistics:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching statistics'
    });
  }
};

// Get testimonials by training ID
const getTestimonialsByTraining = async (req, res) => {
  try {
    const { trainingId } = req.params;
    const { limit = 5 } = req.query;

    // Check if training exists
    const training = await Training.findById(trainingId);
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }

    const testimonials = await Testimonial.find({
      isActive: true,
      approved: true,
      trainingId
    })
      .sort('-rating -createdAt')
      .limit(parseInt(limit));

    return res.status(HTTP_STATUS_CODES.OK).json({
      training: {
        id: training._id,
        title: training.title,
        code: training.code
      },
      testimonials: testimonials.map(formatTestimonialResponse),
      count: testimonials.length
    });
  } catch (error) {
    console.error('Error fetching training testimonials:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching training testimonials'
    });
  }
};

// Toggle featured status
const toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;

    const testimonial = await Testimonial.findById(id);
    if (!testimonial || !testimonial.isActive) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Testimonial not found'
      });
    }

    testimonial.featured = !testimonial.featured;
    testimonial.updatedBy = req.userId;
    await testimonial.save();

    return res.status(HTTP_STATUS_CODES.OK).json({
      message: `Testimonial ${testimonial.featured ? 'featured' : 'unfeatured'} successfully`,
      testimonial: formatTestimonialResponse(testimonial)
    });
  } catch (error) {
    console.error('Error toggling featured status:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while updating featured status'
    });
  }
};

module.exports = {
  getAllTestimonials,
  getFeaturedTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getTestimonialStatistics,
  getTestimonialsByTraining,
  toggleFeatured
};