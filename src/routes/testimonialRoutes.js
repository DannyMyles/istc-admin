const express = require('express');
const router = express.Router();
const {
  getAllTestimonials,
  getFeaturedTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getTestimonialStatistics,
  getTestimonialsByTraining,
  toggleFeatured
} = require('../controllers/testimonialController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getAllTestimonials); // GET /api/v1/testimonials
router.get('/featured', getFeaturedTestimonials); // GET /api/v1/testimonials/featured
router.get('/statistics', getTestimonialStatistics); // GET /api/v1/testimonials/statistics
router.get('/training/:trainingId', getTestimonialsByTraining); // GET /api/v1/testimonials/training/:trainingId
router.get('/:id', getTestimonialById); // GET /api/v1/testimonials/:id

// Protected routes
router.use(authenticate);

// Admin routes
router.post('/', authorize('admin', 'editor'), createTestimonial); // POST /api/v1/testimonials
router.put('/:id', authorize('admin', 'editor'), updateTestimonial); // PUT /api/v1/testimonials/:id
router.delete('/:id', authorize('admin'), deleteTestimonial); // DELETE /api/v1/testimonials/:id

// Admin-only routes
router.patch('/:id/featured', authorize('admin'), toggleFeatured); // PATCH /api/v1/testimonials/:id/featured

module.exports = router;