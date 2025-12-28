// src/controllers/trainingController.js
const Training = require('../models/trainingModel');
const HTTP_STATUS_CODES = require('../utils/statusCodes');

// Helper function to check for existing training
const checkExistingTraining = async (title, excludeId = null) => {
  const query = {
    title: { $regex: new RegExp(`^${title.trim()}$`, 'i') }
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return await Training.findOne(query);
};

// Helper function to format session dates
const formatSessionDates = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const formatDate = (date) => {
    const day = date.getDate();
    const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
    const month = date.toLocaleString('en-US', { month: 'long' });
    return `${day}${suffix} ${month}`;
  };
  
  return `${formatDate(start)} - ${formatDate(end)}`;
};

// Helper function to calculate duration in days
const calculateDurationInDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
};

// Helper function to format training response (FIXED VERSION)
const formatTrainingResponse = (training, detailed = false) => {
  // Manually format sessions to ensure they're included
  const formattedSessions = training.sessions ? training.sessions.map(session => ({
    ...session.toObject ? session.toObject() : session,
    formattedDates: formatSessionDates(session.startDate, session.endDate),
    durationInDays: calculateDurationInDays(session.startDate, session.endDate)
  })) : [];
  
  // Count upcoming sessions
  const upcomingSessions = training.sessions ? training.sessions.filter(s => 
    s.status === 'scheduled' && new Date(s.startDate) > new Date()
  ).length : 0;
  
  const baseResponse = {
    id: training._id,
    code: training.code,
    title: training.title,
    description: training.description,
    targetGroup: training.targetGroup,
    duration: training.duration?.display || 'N/A',
    cost: training.cost?.display || 'N/A',
    category: training.category,
    modeOfStudy: training.modeOfStudy,
    isFeatured: training.isFeatured,
    registrationFee: training.registrationFee,
    certification: training.certification,
    sessions: formattedSessions,  // Use manually formatted sessions
    upcomingSessions: upcomingSessions,  // Use manually calculated count
    slug: training.slug,
    createdAt: training.createdAt
  };
  
  if (detailed) {
    return {
      ...baseResponse,
      prerequisites: training.prerequisites || [],
      learningOutcomes: training.learningOutcomes || [],
      requirements: training.requirements || [],
      allSessions: training.sessions || [],
      createdBy: training.createdBy,
      updatedBy: training.updatedBy,
      updatedAt: training.updatedAt,
      isActive: training.isActive
    };
  }
  
  return baseResponse;
};

// Create a new training course
const createTraining = async (req, res) => {
  try {
    const {
      title,
      description,
      targetGroup,
      duration,
      cost,
      sessions,
      category,
      modeOfStudy,
      prerequisites,
      learningOutcomes,
      certification,
      isFeatured,
      registrationFee,
      requirements
    } = req.body;

    // Required fields validation
    if (!title || !targetGroup || !duration || !cost || !sessions) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'Title, target group, duration, cost, and sessions are required'
      });
    }

    // Check if training with same title already exists
    const existingTraining = await checkExistingTraining(title);
    if (existingTraining) {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({
        error: 'A training course with this title already exists',
        suggestion: 'Please use a different title or update the existing course',
        existingTraining: {
          id: existingTraining._id,
          code: existingTraining.code,
          title: existingTraining.title
        }
      });
    }

    // Validate sessions
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'At least one session is required'
      });
    }

    // Validate each session
    for (const session of sessions) {
      if (!session.startDate || !session.endDate) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          error: 'Each session must have start and end dates'
        });
      }
      
      const startDate = new Date(session.startDate);
      const endDate = new Date(session.endDate);
      
      if (endDate < startDate) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          error: 'End date must be after start date'
        });
      }
    }

    // Create training course
    const training = new Training({
      title,
      description,
      targetGroup,
      duration,
      cost,
      sessions: sessions.map(session => ({
        ...session,
        startDate: new Date(session.startDate),
        endDate: new Date(session.endDate),
        status: session.status || 'scheduled',
        seats: {
          total: session.seats?.total || 20,
          booked: session.seats?.booked || 0,
          available: (session.seats?.total || 20) - (session.seats?.booked || 0)
        },
        venue: session.venue || 'ISTC Training Center',
        instructor: session.instructor
      })),
      category,
      modeOfStudy: modeOfStudy || ['full-time'],
      prerequisites: prerequisites || [],
      learningOutcomes: learningOutcomes || [],
      certification: certification || 'Certificate of Completion',
      isFeatured: isFeatured || false,
      registrationFee: registrationFee || 1000,
      requirements: requirements || [],
      createdBy: req.userId
    });

    await training.save();

    return res.status(HTTP_STATUS_CODES.CREATED).json({
      message: 'Training course created successfully',
      training: formatTrainingResponse(training)
    });
  } catch (error) {
    console.error('Error creating training course:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      
      if (field === 'title') {
        return res.status(HTTP_STATUS_CODES.CONFLICT).json({
          error: 'A training course with this title already exists',
          suggestion: 'Please use a different title'
        });
      } else if (field === 'slug') {
        return res.status(HTTP_STATUS_CODES.CONFLICT).json({
          error: 'A training course with similar title already exists',
          suggestion: 'Please modify the title slightly'
        });
      } else if (field === 'code') {
        // Retry with a different code
        const training = new Training({
          ...req.body,
          code: undefined // Let the pre-save hook generate a new one
        });
        await training.save();
        
        return res.status(HTTP_STATUS_CODES.CREATED).json({
          message: 'Training course created successfully (code regenerated)',
          training: formatTrainingResponse(training)
        });
      }
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        error: errors.join(', ') 
      });
    }
    
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while creating the training course'
    });
  }
};

// Get all training courses (FIXED VERSION)
const getAllTrainings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      modeOfStudy,
      isFeatured,
      isActive = true,
      search,
      startDate,
      endDate,
      sort = '-createdAt'
    } = req.query;
    
    const query = { isActive };
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter by mode of study
    if (modeOfStudy) {
      query.modeOfStudy = modeOfStudy;
    }
    
    // Filter by featured status
    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true';
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { targetGroup: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query['sessions.startDate'] = {};
      if (startDate) {
        query['sessions.startDate'].$gte = new Date(startDate);
      }
      if (endDate) {
        query['sessions.startDate'].$lte = new Date(endDate);
      }
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [trainings, total] = await Promise.all([
      Training.find(query)
        .populate('createdBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Training.countDocuments(query)
    ]);
    
    // Format trainings using our helper function
    const formattedTrainings = trainings.map(training => 
      formatTrainingResponse(training, false)
    );
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      trainings: formattedTrainings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalTrainings: total,
        hasNextPage: skip + trainings.length < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching training courses:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching training courses'
    });
  }
};

// Get training by ID
const getTrainingById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const training = await Training.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      training: formatTrainingResponse(training, true)
    });
  } catch (error) {
    console.error('Error fetching training course:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching the training course'
    });
  }
};

// Get training sessions only
const getTrainingSessions = async (req, res) => {
  try {
    const { id } = req.params;
    
    const training = await Training.findById(id).select('sessions title code');
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      trainingId: training._id,
      title: training.title,
      code: training.code,
      sessionsCount: training.sessions.length,
      sessions: training.sessions
    });
  } catch (error) {
    console.error('Error fetching training sessions:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching sessions'
    });
  }
};

// Get training by slug
const getTrainingBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const training = await Training.findOne({ slug, isActive: true })
      .populate('createdBy', 'name email');
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      training: formatTrainingResponse(training, true)
    });
  } catch (error) {
    console.error('Error fetching training course:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching the training course'
    });
  }
};

// Get training by code
const getTrainingByCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    const training = await Training.findOne({ code, isActive: true })
      .populate('createdBy', 'name email');
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      training: formatTrainingResponse(training, true)
    });
  } catch (error) {
    console.error('Error fetching training course:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching the training course'
    });
  }
};

// Update training course
const updateTraining = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check if training exists
    const existingTraining = await Training.findById(id);
    if (!existingTraining) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    // Check for duplicate title if title is being updated
    if (updates.title && updates.title !== existingTraining.title) {
      const duplicateTraining = await checkExistingTraining(updates.title, id);
      if (duplicateTraining) {
        return res.status(HTTP_STATUS_CODES.CONFLICT).json({
          error: 'A training course with this title already exists',
          suggestion: 'Please use a different title',
          existingTraining: {
            id: duplicateTraining._id,
            code: duplicateTraining.code,
            title: duplicateTraining.title
          }
        });
      }
    }
    
    // Don't allow updating certain fields
    delete updates.code;
    delete updates.slug;
    delete updates.createdBy;
    
    // Find and update training
    const training = await Training.findByIdAndUpdate(
      id,
      { 
        $set: { ...updates, updatedBy: req.userId }
      },
      { new: true, runValidators: true }
    )
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Training course updated successfully',
      training: formatTrainingResponse(training, true)
    });
  } catch (error) {
    console.error('Error updating training course:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        error: errors.join(', ') 
      });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      
      if (field === 'title') {
        return res.status(HTTP_STATUS_CODES.CONFLICT).json({
          error: 'A training course with this title already exists',
          suggestion: 'Please use a different title'
        });
      } else if (field === 'slug') {
        return res.status(HTTP_STATUS_CODES.CONFLICT).json({
          error: 'A training course with similar title already exists',
          suggestion: 'Please modify the title slightly'
        });
      }
    }
    
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while updating the training course'
    });
  }
};

// Delete training course (soft delete)
const deleteTraining = async (req, res) => {
  try {
    const { id } = req.params;
    
    const training = await Training.findByIdAndUpdate(
      id,
      { 
        isActive: false,
        updatedBy: req.userId
      },
      { new: true }
    );
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Training course deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting training course:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while deleting the training course'
    });
  }
};

// Add new session to training (IMPROVED VERSION)
const addTrainingSession = async (req, res) => {
  try {
    const { id } = req.params;
    const sessionData = req.body;
    
    console.log('Adding session to training ID:', id);
    console.log('Session data received:', sessionData);
    
    // Validate required fields
    if (!sessionData.startDate || !sessionData.endDate) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'Start date and end date are required'
      });
    }
    
    // Validate dates
    const startDate = new Date(sessionData.startDate);
    const endDate = new Date(sessionData.endDate);
    
    if (endDate < startDate) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'End date must be after start date'
      });
    }
    
    // Find training
    const training = await Training.findById(id);
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    console.log(`Training found: ${training.title} (${training.code})`);
    console.log(`Current sessions count: ${training.sessions.length}`);
    
    // Check for overlapping sessions (optional)
    const hasOverlap = training.sessions.some(session => {
      const sessionStart = new Date(session.startDate);
      const sessionEnd = new Date(session.endDate);
      return (startDate <= sessionEnd && endDate >= sessionStart);
    });
    
    if (hasOverlap) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'Session dates overlap with an existing session',
        suggestion: 'Please choose different dates'
      });
    }
    
    // Create new session
    const newSession = {
      startDate: startDate,
      endDate: endDate,
      status: sessionData.status || 'scheduled',
      seats: {
        total: sessionData.seats?.total || 20,
        booked: sessionData.seats?.booked || 0,
        available: (sessionData.seats?.total || 20) - (sessionData.seats?.booked || 0)
      },
      venue: sessionData.venue || 'ISTC Training Center',
      instructor: sessionData.instructor
    };
    
    console.log('New session to add:', newSession);
    
    // Add session to training
    training.sessions.push(newSession);
    training.updatedBy = req.userId;
    
    // Save training
    await training.save();
    console.log('Training saved successfully');
    
    // Fetch updated training to verify
    const updatedTraining = await Training.findById(id);
    console.log(`Updated sessions count: ${updatedTraining.sessions.length}`);
    
    // Return success response
    return res.status(HTTP_STATUS_CODES.CREATED).json({
      message: 'Session added successfully',
      sessionId: updatedTraining.sessions[updatedTraining.sessions.length - 1]._id,
      sessionsCount: updatedTraining.sessions.length,
      training: formatTrainingResponse(updatedTraining, true)
    });
  } catch (error) {
    console.error('Error adding session:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        error: errors.join(', ') 
      });
    }
    
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while adding the session',
      details: error.message
    });
  }
};

// Update session
const updateTrainingSession = async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    const updates = req.body;
    
    const training = await Training.findById(id);
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    const sessionIndex = training.sessions.findIndex(
      session => session._id.toString() === sessionId
    );
    
    if (sessionIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Session not found'
      });
    }
    
    // Update session fields
    if (updates.startDate) {
      training.sessions[sessionIndex].startDate = new Date(updates.startDate);
    }
    
    if (updates.endDate) {
      training.sessions[sessionIndex].endDate = new Date(updates.endDate);
    }
    
    if (updates.status) {
      training.sessions[sessionIndex].status = updates.status;
    }
    
    if (updates.seats?.total !== undefined) {
      training.sessions[sessionIndex].seats.total = updates.seats.total;
      training.sessions[sessionIndex].seats.available = 
        updates.seats.total - training.sessions[sessionIndex].seats.booked;
    }
    
    if (updates.venue !== undefined) {
      training.sessions[sessionIndex].venue = updates.venue;
    }
    
    if (updates.instructor !== undefined) {
      training.sessions[sessionIndex].instructor = updates.instructor;
    }
    
    training.updatedBy = req.userId;
    await training.save();
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Session updated successfully',
      training: formatTrainingResponse(training, true)
    });
  } catch (error) {
    console.error('Error updating session:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while updating the session'
    });
  }
};

// Delete session
const deleteTrainingSession = async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    
    const training = await Training.findById(id);
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    const sessionIndex = training.sessions.findIndex(
      session => session._id.toString() === sessionId
    );
    
    if (sessionIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Session not found'
      });
    }
    
    // Store deleted session info for response
    const deletedSession = training.sessions[sessionIndex];
    
    training.sessions.splice(sessionIndex, 1);
    training.updatedBy = req.userId;
    await training.save();
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Session deleted successfully',
      deletedSession: {
        startDate: deletedSession.startDate,
        endDate: deletedSession.endDate,
        venue: deletedSession.venue
      },
      training: formatTrainingResponse(training, true)
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while deleting the session'
    });
  }
};

// Get featured trainings
const getFeaturedTrainings = async (req, res) => {
  try {
    const trainings = await Training.find({ 
      isFeatured: true, 
      isActive: true 
    })
    .populate('createdBy', 'name email')
    .sort('-createdAt')
    .limit(8);
    
    const formattedTrainings = trainings.map(training => 
      formatTrainingResponse(training, false)
    );
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      trainings: formattedTrainings
    });
  } catch (error) {
    console.error('Error fetching featured trainings:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching featured trainings'
    });
  }
};

// Get upcoming trainings
const getUpcomingTrainings = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const trainings = await Training.find({
      isActive: true,
      'sessions.startDate': { $gte: today }
    })
    .populate('createdBy', 'name email')
    .sort('sessions.startDate')
    .limit(parseInt(limit));
    
    const formattedTrainings = trainings.map(training => 
      formatTrainingResponse(training, false)
    );
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      trainings: formattedTrainings
    });
  } catch (error) {
    console.error('Error fetching upcoming trainings:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching upcoming trainings'
    });
  }
};

// Get training categories
const getTrainingCategories = async (req, res) => {
  try {
    const categories = await Training.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      categories: categories.map(cat => ({
        name: cat._id,
        count: cat.count,
        slug: cat._id.toLowerCase().replace(/\s+/g, '-')
      }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while fetching categories'
    });
  }
};

// Search trainings
const searchTrainings = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        error: 'Search query must be at least 2 characters long'
      });
    }
    
    const query = {
      isActive: true,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } },
        { targetGroup: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ]
    };
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [trainings, total] = await Promise.all([
      Training.find(query)
        .populate('createdBy', 'name email')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      Training.countDocuments(query)
    ]);
    
    const formattedTrainings = trainings.map(training => 
      formatTrainingResponse(training, false)
    );
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      trainings: formattedTrainings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalResults: total,
        query: q
      }
    });
  } catch (error) {
    console.error('Error searching trainings:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while searching trainings'
    });
  }
};

module.exports = {
  createTraining,
  getAllTrainings,
  getTrainingById,
  getTrainingSessions,
  getTrainingBySlug,
  getTrainingByCode,
  updateTraining,
  deleteTraining,
  addTrainingSession,
  updateTrainingSession,
  deleteTrainingSession,
  getFeaturedTrainings,
  getUpcomingTrainings,
  getTrainingCategories,
  searchTrainings,
};