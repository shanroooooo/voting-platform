const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Try to find user first, then driver
    let user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      user = await Driver.findById(decoded.userId).select('-password');
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.'
    });
  }
  next();
};

const restaurantOwnerMiddleware = (req, res, next) => {
  if (req.user.role !== 'restaurant_owner') {
    return res.status(403).json({
      success: false,
      message: 'Restaurant owner access required.'
    });
  }
  next();
};

const driverMiddleware = (req, res, next) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Driver access required.'
    });
  }
  next();
};

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      let user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        user = await Driver.findById(decoded.userId).select('-password');
      }

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  restaurantOwnerMiddleware,
  driverMiddleware,
  optionalAuthMiddleware
};
