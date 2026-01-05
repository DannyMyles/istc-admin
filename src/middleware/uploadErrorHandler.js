const multer = require('multer');
const HTTP_STATUS_CODES = require('../utils/statusCodes');

const uploadErrorHandler = (err, req, res, next) => {
  // Handle multer-specific errors
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
          error: 'File size exceeds the allowed limit of 16MB.' 
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
          error: 'Too many files uploaded.' 
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
          error: 'Unexpected field in file upload.' 
        });
      case 'LIMIT_PART_COUNT':
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
          error: 'Too many parts in the upload.' 
        });
      case 'LIMIT_FIELD_KEY':
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
          error: 'Field name is too long.' 
        });
      case 'LIMIT_FIELD_VALUE':
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
          error: 'Field value is too long.' 
        });
      case 'LIMIT_FIELD_COUNT':
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
          error: 'Too many fields in the form.' 
        });
      default:
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
          error: `Multer error: ${err.message}` 
        });
    }
  }
  
  // Handle file filter errors
  if (err.message && err.message.includes('Only image files are allowed')) {
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
      error: err.message 
    });
  }
  
  // Handle other errors
  if (err) {
    console.error('General error during file upload:', err.message); 
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
      error: `An error occurred during file upload: ${err.message}` 
    });
  }
  
  next();
};

module.exports = uploadErrorHandler;