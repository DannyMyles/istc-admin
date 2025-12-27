require('dotenv').config(); 
const jwt = require("jsonwebtoken");
const HTTP_STATUS_CODES = require('../utils/statusCodes');

const authenticateUser = (req, res, next) => {
    const authHeader = req.header("Authorization");
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Access denied, token not provided" });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access denied, token not provided" });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET_KEY);
        req.userId = verified.userId;
        req.userRole = verified.role;
        next();
    } catch (err) {
        console.error('Token verification error:', err);
        return res.status(400).json({ error: "Invalid token" });
    }
};

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        error: 'Access denied. No token provided.'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
      error: 'Invalid or expired token'
    });
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        error: 'User not authenticated'
      });
    }
    
    if (roles.length && !roles.includes(req.userRole)) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        error: 'You do not have permission to perform this action'
      });
    }
    
    next();
  };
};

module.exports = { authenticateUser, authenticate, authorize };