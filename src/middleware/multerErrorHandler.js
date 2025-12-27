const multer = require('multer');
const HTTP_STATUS_CODES = require('../utils/statusCodes');

const multerErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
                error: 'File size exceeds the allowed limit of 5MB.' 
            });
        }
    }
    
    if (err) {
        console.error('General error during file upload:', err.message); 
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
            error: `An error occurred during file upload: ${err.message}` 
        });
    }
    next();
};

module.exports = multerErrorHandler;