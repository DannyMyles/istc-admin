const { Op, fn, col } = require('sequelize');
const { Training, Testimonial } = require('../models');
const HTTP_STATUS_CODES = require('../utils/statusCodes');

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

// Helper function to safely parse JSON fields (handles both string and object)
const safeParseJSON = (field, defaultValue = null) => {
  if (field === null || field === undefined) {
    return defaultValue;
  }
  if (typeof field === 'object') {
    return field; // Already parsed
  }
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      console.error('Error parsing JSON field:', field, e);
      return defaultValue;
    }
  }
  return defaultValue;
};

// Helper function to format training response
const formatTrainingResponse = (training, detailed = false) => {
  // Parse sessions - handle both string and array formats from Sequelize
  const sessionsData = safeParseJSON(training.sessions, []);
  const sessionsArray = Array.isArray(sessionsData) ? sessionsData : [];
  
  const formattedSessions = sessionsArray.map(session => ({
    startDate: session.startDate,
    endDate: session.endDate,
    seats: session.seats,
    venue: session.venue,
    instructor: session.instructor,
    status: session.status || 'scheduled',
    formattedDates: formatSessionDates(session.startDate, session.endDate),
    durationInDays: calculateDurationInDays(session.startDate, session.endDate)
  }));
  
  // Count upcoming sessions
  const upcomingSessions = sessionsArray.filter(s => 
    s.status === 'scheduled' && new Date(s.startDate) > new Date()
  ).length;
  
  // Parse other JSON fields that might come as strings
  const duration = safeParseJSON(training.duration, { value: 0, unit: 'days', display: '0 days' });
  const cost = safeParseJSON(training.cost, { amount: 0, currency: 'KSH', display: 'KSH 0', taxInclusive: false });
  const modeOfStudy = safeParseJSON(training.modeOfStudy, ['full-time']);
  const prerequisites = safeParseJSON(training.prerequisites, []);
  const learningOutcomes = safeParseJSON(training.learningOutcomes, []);
  const requirements = safeParseJSON(training.requirements, []);
  
  const baseResponse = {
    id: training.id,
    code: training.code,
    title: training.title,
    description: training.description,
    targetGroup: training.targetGroup,
    duration: duration,
    cost: cost,
    category: training.category,
    modeOfStudy: modeOfStudy,
    isFeatured: training.isFeatured,
    registrationFee: training.registrationFee,
    certification: training.certification,
    sessions: formattedSessions,
    upcomingSessions: upcomingSessions,
    slug: training.slug,
    createdAt: training.createdAt
  };
  
  if (detailed) {
    return {
      ...baseResponse,
      prerequisites: prerequisites,
      learningOutcomes: learningOutcomes,
      requirements: requirements,
      allSessions: sessionsArray,
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
    const existingTraining = await Training.findOne({
      where: { title: { [Op.like]: title.trim() } }
    });
    if (existingTraining) {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({
        error: 'A training course with this title already exists',
        suggestion: 'Please use a different title or update the existing course',
        existingTraining: {
          id: existingTraining.id,
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
    const training = await Training.create({
      title,
      description,
      targetGroup,
      duration,
      cost,
      sessions: sessions.map(session => {
        const totalSeats = session.seats?.total || 20;
        return {
          ...session,
          startDate: new Date(session.startDate),
          endDate: new Date(session.endDate),
          status: session.status || 'scheduled',
          seats: {
            total: totalSeats,
            booked: 0,
            available: totalSeats
          },
          venue: session.venue || 'ISTC Training Center',
          instructor: session.instructor
        };
      }),
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

    return res.status(HTTP_STATUS_CODES.CREATED).json({
      message: 'Training course created successfully',
      training: formatTrainingResponse(training)
    });
  } catch (error) {
    console.error('Error creating training course:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = Object.keys(error.fields || {})[0];
      
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

    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        error: errors.join(', ') 
      });
    }

    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: 'An error occurred while creating the training course'
    });
  }
};

// Get all training courses
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
      sort = 'createdAt',
      order = 'DESC'
    } = req.query;
    
    const query = { isActive: isActive === 'true' ? true : isActive === 'false' ? false : true };
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter by mode of study
    if (modeOfStudy) {
      query.modeOfStudy = { [Op.like]: `%${modeOfStudy}%` };
    }
    
    // Filter by featured status
    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true';
    }
    
    // Search functionality
    if (search) {
      query[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { targetGroup: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const orderArr = [[sort, order]];
    
    const { count, rows: trainings } = await Training.findAndCountAll({
      where: query,
      order: orderArr,
      limit: parseInt(limit),
      offset
    });
    
    // Format trainings using our helper function
    const formattedTrainings = trainings.map(training => 
      formatTrainingResponse(training, false)
    );
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      trainings: formattedTrainings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalTrainings: count,
        hasNextPage: offset + trainings.length < count,
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
    const trainingId = parseInt(id);
    
    const training = await Training.findByPk(trainingId);
    
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
    const trainingId = parseInt(id);
    
    const training = await Training.findByPk(trainingId, {
      attributes: ['id', 'title', 'code', 'sessions']
    });
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      trainingId: training.id,
      title: training.title,
      code: training.code,
      sessionsCount: training.sessions?.length || 0,
      sessions: training.sessions || []
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
    
    const training = await Training.findOne({ 
      where: { slug, isActive: true } 
    });
    
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
    
    const training = await Training.findOne({ 
      where: { code, isActive: true } 
    });
    
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
    const trainingId = parseInt(id);
    const updates = req.body;
    
    // Check if training exists
    const existingTraining = await Training.findByPk(trainingId);
    if (!existingTraining) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    // Check for duplicate title if title is being updated
    if (updates.title && updates.title !== existingTraining.title) {
      const duplicateTraining = await Training.findOne({
        where: { 
          title: { [Op.like]: updates.title },
          id: { [Op.ne]: trainingId }
        }
      });
      if (duplicateTraining) {
        return res.status(HTTP_STATUS_CODES.CONFLICT).json({
          error: 'A training course with this title already exists',
          suggestion: 'Please use a different title',
          existingTraining: {
            id: duplicateTraining.id,
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
    
    // Update training
    await Training.update(
      { ...updates, updatedBy: req.userId },
      { where: { id: trainingId }, individualHooks: true }
    );
    
    const training = await Training.findByPk(trainingId);
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Training course updated successfully',
      training: formatTrainingResponse(training, true)
    });
  } catch (error) {
    console.error('Error updating training course:', error);
    
    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
        error: errors.join(', ') 
      });
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({
        error: 'A training course with this title already exists',
        suggestion: 'Please use a different title'
      });
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
    const trainingId = parseInt(id);
    
    const training = await Training.findByPk(trainingId);
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    await Training.update(
      { isActive: false, updatedBy: req.userId },
      { where: { id: trainingId } }
    );
    
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

// Add new session to training
const addTrainingSession = async (req, res) => {
  try {
    const { id } = req.params;
    const trainingId = parseInt(id);
    const sessionData = req.body;
    
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
    const training = await Training.findByPk(trainingId);
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    // Get current sessions - ensure it's always an array
    const sessions = Array.isArray(training.sessions) ? training.sessions : [];
    
    // Check for overlapping sessions
    const hasOverlap = sessions.some(session => {
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
    const totalSeats = sessionData.seats?.total || 20;
    const newSession = {
      startDate: startDate,
      endDate: endDate,
      status: sessionData.status || 'scheduled',
      seats: {
        total: totalSeats,
        booked: 0,
        available: totalSeats
      },
      venue: sessionData.venue || 'ISTC Training Center',
      instructor: sessionData.instructor
    };
    
    // Add session to training
    sessions.push(newSession);
    
    await Training.update(
      { sessions, updatedBy: req.userId },
      { where: { id: trainingId } }
    );
    
    const updatedTraining = await Training.findByPk(trainingId);
    
    return res.status(HTTP_STATUS_CODES.CREATED).json({
      message: 'Session added successfully',
      sessionId: updatedTraining.sessions[updatedTraining.sessions.length - 1].id,
      sessionsCount: updatedTraining.sessions.length,
      training: formatTrainingResponse(updatedTraining, true)
    });
  } catch (error) {
    console.error('Error adding session:', error);
    
    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
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
    const trainingId = parseInt(id);
    const sessionIdNum = parseInt(sessionId);
    const updates = req.body;
    
    const training = await Training.findByPk(trainingId);
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    // Ensure sessions is always an array
    const sessions = Array.isArray(training.sessions) ? training.sessions : [];
    const sessionIndex = sessions.findIndex(session => session.id === sessionIdNum);
    
    if (sessionIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Session not found'
      });
    }
    
    // Update session fields
    if (updates.startDate) {
      sessions[sessionIndex].startDate = new Date(updates.startDate);
    }
    
    if (updates.endDate) {
      sessions[sessionIndex].endDate = new Date(updates.endDate);
    }
    
    if (updates.status) {
      sessions[sessionIndex].status = updates.status;
    }
    
    if (updates.seats?.total !== undefined) {
      sessions[sessionIndex].seats.total = updates.seats.total;
      sessions[sessionIndex].seats.available = 
        updates.seats.total - sessions[sessionIndex].seats.booked;
    }
    
    if (updates.venue !== undefined) {
      sessions[sessionIndex].venue = updates.venue;
    }
    
    if (updates.instructor !== undefined) {
      sessions[sessionIndex].instructor = updates.instructor;
    }
    
    await Training.update(
      { sessions, updatedBy: req.userId },
      { where: { id: trainingId } }
    );
    
    const updatedTraining = await Training.findByPk(trainingId);
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Session updated successfully',
      training: formatTrainingResponse(updatedTraining, true)
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
    const trainingId = parseInt(id);
    const sessionIdNum = parseInt(sessionId);
    
    const training = await Training.findByPk(trainingId);
    
    if (!training) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Training course not found'
      });
    }
    
    // Ensure sessions is always an array
    const sessions = Array.isArray(training.sessions) ? training.sessions : [];
    const sessionIndex = sessions.findIndex(session => session.id === sessionIdNum);
    
    if (sessionIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        error: 'Session not found'
      });
    }
    
    // Store deleted session info for response
    const deletedSession = sessions[sessionIndex];
    
    // Remove session
    sessions.splice(sessionIndex, 1);
    
    await Training.update(
      { sessions, updatedBy: req.userId },
      { where: { id: trainingId } }
    );
    
    const updatedTraining = await Training.findByPk(trainingId);
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Session deleted successfully',
      deletedSession: {
        startDate: deletedSession.startDate,
        endDate: deletedSession.endDate,
        venue: deletedSession.venue
      },
      training: formatTrainingResponse(updatedTraining, true)
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
    const trainings = await Training.findAll({
      where: { 
        isFeatured: true, 
        isActive: true 
      },
      order: [['createdAt', 'DESC']],
      limit: 8
    });
    
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
    
    // This is a simplified approach - in production you might want a more complex query
    const trainings = await Training.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });
    
    // Filter for upcoming sessions in JavaScript
    const upcomingTrainings = trainings.filter(training => {
      // Ensure sessions is always an array
      const sessions = Array.isArray(training.sessions) ? training.sessions : [];
      return sessions.some(session => 
        session.status === 'scheduled' && new Date(session.startDate) > today
      );
    });
    
    const formattedTrainings = upcomingTrainings.map(training => 
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
    const { sequelize } = require('../models');
    
    const categories = await Training.findAll({
      where: { isActive: true },
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
    });
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      categories: categories.map(cat => ({
        name: cat.category,
        count: parseInt(cat.get('count')),
        slug: cat.category.toLowerCase().replace(/\s+/g, '-')
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
    
    const searchPattern = `%${q}%`;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows: trainings } = await Training.findAndCountAll({
      where: {
        isActive: true,
        [Op.or]: [
          { title: { [Op.like]: searchPattern } },
          { description: { [Op.like]: searchPattern } },
          { code: { [Op.like]: searchPattern } },
          { targetGroup: { [Op.like]: searchPattern } },
          { category: { [Op.like]: searchPattern } }
        ]
      },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    const formattedTrainings = trainings.map(training => 
      formatTrainingResponse(training, false)
    );
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      trainings: formattedTrainings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalResults: count,
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

