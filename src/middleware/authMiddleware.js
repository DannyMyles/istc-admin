const jwt = require("jsonwebtoken");
const HTTP_STATUS_CODES = require('../utils/statusCodes');

const authenticate = (req, res, next) => {
  try {
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        error: 'Access denied. No token provided.'
      });
    }
    
    // Check if it's in Bearer format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        error: 'Token format should be: Bearer [token]'
      });
    }
    
    const token = parts[1];
    
    // Check if token is empty
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        error: 'Invalid token format'
      });
    }
    
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    
    // Attach user info to request
    req.userId = decoded.userId;
    
    // Extract role name - prefer 'role' (string) over 'roleId' (ObjectId)
    // The authorize middleware expects role names like 'admin', 'user', etc.
    if (decoded.role) {
      req.userRole = decoded.role;
    } else if (decoded.roleId) {
      // roleId is an ObjectId, we'll need to handle this in routes that need it
      req.userRoleId = decoded.roleId;
      req.userRole = null; // Will need to be populated from DB if needed
    }
    
    req.userEmail = decoded.email;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error.name, error.message);
    
    // Handle specific JWT errors
    switch (error.name) {
      case 'JsonWebTokenError':
        if (error.message === 'jwt malformed') {
          return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            error: 'Invalid token format. Please login again.'
          });
        }
        return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
          error: 'Invalid token'
        });
        
      case 'TokenExpiredError':
        return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
          error: 'Token expired. Please login again.'
        });
        
      default:
        return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
          error: 'Authentication failed'
        });
    }
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        error: 'User not authenticated'
      });
    }
    
    // If roles array is empty, allow all authenticated users
    if (roles.length > 0 && !roles.includes(req.userRole)) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        error: `Access denied. Required role: ${roles.join(', ')}`
      });
    }
    
    next();
  };
};

// Keep backward compatibility
const authenticateUser = authenticate;

module.exports = { authenticate, authorize, authenticateUser };
