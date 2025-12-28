// src/routes/trainingRoutes.js
const express = require('express');
const router = express.Router();
const {
  createTraining,
  getAllTrainings,
  getTrainingById,
  getTrainingSessions,  // New
  getTrainingByCode,
  updateTraining,
  deleteTraining,
  addTrainingSession,
  updateTrainingSession,
  deleteTrainingSession,
  getFeaturedTrainings,
  getUpcomingTrainings,
  getTrainingCategories
} = require('../controllers/trainingController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getAllTrainings); // GET /api/v1/trainings
router.get('/featured', getFeaturedTrainings); // GET /api/v1/trainings/featured
router.get('/upcoming', getUpcomingTrainings); // GET /api/v1/trainings/upcoming
router.get('/categories', getTrainingCategories); // GET /api/v1/trainings/categories
router.get('/code/:code', getTrainingByCode); // GET /api/v1/trainings/code/:code
router.get('/:id', getTrainingById); // GET /api/v1/trainings/:id
router.get('/:id/sessions', getTrainingSessions);  // New route


// Protected routes (Admin/Editor only)
router.post('/', authenticate, authorize('admin', 'editor'), createTraining); // POST /api/v1/trainings
router.put('/:id', authenticate, authorize('admin', 'editor'), updateTraining); // PUT /api/v1/trainings/:id
router.delete('/:id', authenticate, authorize('admin'), deleteTraining); // DELETE /api/v1/trainings/:id

// Session management routes
router.post('/:id/sessions', authenticate, authorize('admin', 'editor'), addTrainingSession); // POST /api/v1/trainings/:id/sessions
router.put('/:id/sessions/:sessionId', authenticate, authorize('admin', 'editor'), updateTrainingSession); // PUT /api/v1/trainings/:id/sessions/:sessionId
router.delete('/:id/sessions/:sessionId', authenticate, authorize('admin'), deleteTrainingSession); // DELETE /api/v1/trainings/:id/sessions/:sessionId

module.exports = router;