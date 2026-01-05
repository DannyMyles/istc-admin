const multer = require('multer');
const path = require('path');

// Memory storage for Buffer (MongoDB storage)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
  
  // Check extension
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  
  // Check MIME type
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp, svg)'));
  }
};

// Configure multer for MongoDB storage (Buffer) - Updated to 16MB
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 16 * 1024 * 1024 // Increased to 16MB for MongoDB
  }
});

// Export upload middleware directly
module.exports = upload;