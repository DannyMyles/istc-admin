const { Op } = require('sequelize');
const { Testimonial, Training, User } = require('../models');
const HTTP_STATUS_CODES = require('../utils/statusCodes');

// Helper function to format testimonial response
const formatTestimonialResponse = (testimonial) => {
  const data = testimonial.toJSON ? testimonial.toJSON() : testimonial.get();
  return {
    id: testimonial.id,
    name: testimonial.name,
    role: testimonial.role,
    company: testimonial.company || (testimonial.role && testimonial.role.includes(',') ? testimonial.role.split(',')[1]?.trim() : null),
    content: testimonial.content,
    rating: testimonial.rating,
    image: testimonial.image || testimonial.getInitials(),
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
      sort = 'createdAt',
      order = 'DESC'
    } = req.query;

    const query = { isActive: true, approved: true };

    // Filter by featured status
    if (featured !== undefined) {
      query.featured = featured === 'true';
    }

    // Filter by minimum rating
    if (rating) {
      query.rating = { [Op.gte]: parseInt(rating) };
    }

    // Filter by training
    if (trainingId) {
      query.trainingId = trainingId;
    }

    // Search functionality
    if (search) {
      query[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { role: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } },
        { trainingName: { [Op.like]: `%${search}%` } }
      ];
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const orderArr = [[sort, order]];

    const { count, rows: testimonials } = await Testimonial.findAndCountAll({
      where: query,
      order: orderArr,
      limit: parseInt(limit),
      offset
    });

    return res.status(HTTP_STATUS_CODES.OK).json({
      testimonials: testimonials.map(formatTestimonialResponse),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalTestimonials: count,
        hasNextPage: offset + testimonials.length < count,
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

    const testimonials = await Testimonial.findAll({
      where: {
        isActive: true,
        approved: true,
        featured: true
      },
      order: [['rating', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

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
    const testimonialId = parseInt(id);

    const testimonial = await Testimonial.findByPk(testimonialId, {
      include: [
        { model: Training, as: 'training', attributes: ['id', 'title', 'code'] }
      ]
    });

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
      const training = await Training.findByPk(trainingId);
      if (!training) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          error: 'Training course not found'
        });
      }
    }

    // Create testimonial
    const testimonial = await Testimonial.create({
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

    return res.status(HTTP_STATUS_CODES.CREATED).json({
      message: 'Testimonial created successfully',
      testimonial: formatTestimonialResponse(testimonial)
    });
  } catch (error) {
    console.error('Error creating testimonial:', error);

    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
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
    const testimonialId = parseInt(id);
    const updates = req.body;

    // Check if testimonial exists
    const testimonial = await Testimonial.findByPk(testimonialId);
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
      const training = await Training.findByPk(updates.trainingId);
      if (!training) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          error: 'Training course not found'
        });
      }
    }

    // Update testimonial
    await Testimonial.update(
      { ...updates, updatedBy: req.userId },
      { where: { id: testimonialId }, individualHooks: true }
    );

    const updatedTestimonial = await Testimonial.findByPk(testimonialId);

    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Testimonial updated successfully',
      testimonial: formatTestimonialResponse(updatedTestimonial)
    });
  } catch (error) {
    console.error('Error updating testimonial:', error);

    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
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
    const testimonialId = parseInt(id);

    const testimonial = await Testimonial.findByPk(testimonialId);
    if (!testimonial) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Testimonial not found'
      });
    }

    // Soft delete - just mark as inactive
    await Testimonial.update(
      { isActive: false, updatedBy: req.userId },
      { where: { id: testimonialId } }
    );

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
    const { sequelize } = require('../models');

    const [
      totalTestimonials,
      featuredCount,
      averageRatingResult,
      ratingDistribution
    ] = await Promise.all([
      // Total testimonials
      Testimonial.count({ where: { isActive: true, approved: true } }),

      // Featured testimonials count
      Testimonial.count({
        where: {
          isActive: true,
          approved: true,
          featured: true
        }
      }),

      // Average rating
      Testimonial.findOne({
        attributes: [
          [sequelize.fn('AVG', sequelize.col('rating')), 'averageRating']
        ],
        where: { isActive: true, approved: true }
      }),

      // Rating distribution
      Testimonial.findAll({
        attributes: [
          'rating',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: { isActive: true, approved: true },
        group: ['rating'],
        order: [['rating', 'DESC']]
      })
    ]);

    const averageRating = parseFloat(averageRatingResult?.get('averageRating') || 0);

    // Calculate rating distribution as percentages
    const total = ratingDistribution.reduce((sum, item) => sum + parseInt(item.get('count')), 0);
    const distribution = ratingDistribution.map(item => ({
      rating: item.rating,
      count: parseInt(item.get('count')),
      percentage: total > 0 ? Math.round((parseInt(item.get('count')) / total) * 100) : 0
    }));

    return res.status(HTTP_STATUS_CODES.OK).json({
      statistics: {
        totalTestimonials,
        featuredCount,
        averageRating: parseFloat(averageRating.toFixed(1)),
        ratingDistribution: distribution
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
    const trainingIdInt = parseInt(trainingId);

    // Check if training exists
    const training = await Training.findByPk(trainingIdInt, {
      attributes: ['id', 'title', 'code']
    });
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }

    const testimonials = await Testimonial.findAll({
      where: {
        isActive: true,
        approved: true,
        trainingId: trainingIdInt
      },
      order: [['rating', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    return res.status(HTTP_STATUS_CODES.OK).json({
      training: {
        id: training.id,
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
    const testimonialId = parseInt(id);

    const testimonial = await Testimonial.findByPk(testimonialId);
    if (!testimonial || !testimonial.isActive) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Testimonial not found'
      });
    }

    await Testimonial.update(
      { featured: !testimonial.featured, updatedBy: req.userId },
      { where: { id: testimonialId } }
    );

    const updatedTestimonial = await Testimonial.findByPk(testimonialId);

    return res.status(HTTP_STATUS_CODES.OK).json({
      message: `Testimonial ${updatedTestimonial.featured ? 'featured' : 'unfeatured'} successfully`,
      testimonial: formatTestimonialResponse(updatedTestimonial)
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

