const express = require('express');
const router = express.Router();
const {
  createBlog,
  getAllBlogs,
  getBlogBySlug,
  getBlogById,
  updateBlog,
  deleteBlog,
  getFeaturedBlogs,
  getBlogCategories,
  likeBlog
} = require('../controllers/blogController');

const { authenticate, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getAllBlogs);
router.get('/featured', getFeaturedBlogs);
router.get('/categories', getBlogCategories);
router.get('/slug/:slug', getBlogBySlug);
router.get('/:id', getBlogById);
router.post('/:id/like', likeBlog);

// Protected routes (require authentication)
router.post('/', authenticate, authorize(['admin', 'editor']), createBlog);
router.put('/:id', authenticate, authorize(['admin', 'editor']), updateBlog);
router.delete('/:id', authenticate, authorize(['admin']), deleteBlog);

module.exports = router;