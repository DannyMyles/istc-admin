const HTTP_STATUS_CODES = require('../utils/statusCodes');

const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    // Mongoose/MongoDB errors
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            error: 'Validation Error',
            messages
        });
    }

    if (err.code === 11000) {
        return res.status(HTTP_STATUS_CODES.CONFLICT).json({
            error: 'Duplicate Entry',
            message: 'This record already exists'
        });
    }

    if (err.name === 'CastError') {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            error: 'Invalid ID',
            message: 'The provided ID is invalid'
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
            error: 'Invalid Token',
            message: 'Authentication token is invalid'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
            error: 'Token Expired',
            message: 'Authentication token has expired'
        });
    }

    // Default error
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        error: 'Server Error',
        message: 'Something went wrong on the server'
    });
};

module.exports = errorHandler;