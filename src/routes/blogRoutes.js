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
  likeBlog,
  getBlogImage,
  getBlogImageWithInfo,
  getBlogStats
} = require('../controllers/blogController');

const { authenticate, authorize } = require('../middleware/authMiddleware');
const upload = require('../utils/multerConfig');
const uploadErrorHandler = require('../middleware/uploadErrorHandler');

// Public routes
router.get('/', getAllBlogs);
router.get('/featured', getFeaturedBlogs);
router.get('/categories', getBlogCategories);
router.get('/stats', getBlogStats);
router.get('/slug/:slug', getBlogBySlug);
router.get('/:id', getBlogById);
router.get('/:id/image', getBlogImage);
router.get('/:id/image-info', getBlogImageWithInfo);
router.post('/:id/like', likeBlog);

// Protected routes with file upload and error handling
router.post(
  '/', 
  authenticate, 
  authorize(['admin', 'editor']),
  upload.single('image'), // Multer middleware
  uploadErrorHandler, // Error handling middleware
  createBlog
);

router.put(
  '/:id', 
  authenticate, 
  authorize(['admin', 'editor']),
  upload.single('image'), // Multer middleware
  uploadErrorHandler, // Error handling middleware
  updateBlog
);

router.delete('/:id', authenticate, authorize(['admin']), deleteBlog);

module.exports = router;