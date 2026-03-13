const express = require('express');
const Driver = require('../models/Driver');
const Order = require('../models/Order');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/drivers
// @desc    Get all drivers (admin only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { page = 1, limit = 10, isAvailable } = req.query;
    
    let query = {};
    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    const drivers = await Driver.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Driver.countDocuments(query);

    res.json({
      success: true,
      data: {
        drivers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/drivers/nearby
// @desc    Get nearby available drivers
router.get('/nearby', authMiddleware, async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const drivers = await Driver.find({
      isAvailable: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(radius) * 1000
        }
      }
    }).select('name phone vehicle location averageRating completedOrders');

    res.json({
      success: true,
      data: drivers
    });
  } catch (error) {
    logger.error('Get nearby drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/drivers/:id
// @desc    Get driver profile
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .select('-password -bankAccount')
      .populate('currentOrder', 'restaurant status totalAmount');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    logger.error('Get driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/drivers/register
// @desc    Register new driver
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      licenseNumber,
      vehicle,
      bankAccount
    } = req.body;

    // Check if driver already exists
    const existingDriver = await Driver.findOne({ 
      $or: [{ email }, { phone }, { licenseNumber }] 
    });

    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: 'Driver with this email, phone, or license already exists'
      });
    }

    const driver = new Driver({
      name,
      email,
      phone,
      password,
      licenseNumber,
      vehicle,
      bankAccount
    });

    await driver.save();

    // Generate JWT token
    const token = driver.generateAuthToken();

    res.status(201).json({
      success: true,
      data: {
        driver: {
          id: driver._id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          vehicle: driver.vehicle,
          isAvailable: driver.isAvailable
        },
        token
      },
      message: 'Driver registered successfully'
    });
  } catch (error) {
    logger.error('Register driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/drivers/:id/profile
// @desc    Update driver profile
router.put('/:id/profile', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const driver = await Driver.findById(id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check authorization
    if (driver._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    // Don't allow password update through this endpoint
    delete updates.password;

    Object.assign(driver, updates);
    await driver.save();

    res.json({
      success: true,
      data: driver,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Update driver profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/drivers/:id/location
// @desc    Update driver location
router.put('/:id/location', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    const driver = await Driver.findById(id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check authorization
    if (driver._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this location'
      });
    }

    driver.location = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };
    driver.lastLocationUpdate = new Date();
    await driver.save();

    // Emit real-time location update
    const io = req.app.get('io');
    if (driver.currentOrder) {
      io.to(`order-${driver.currentOrder}`).emit('driver-location', {
        driverId: id,
        location: { latitude, longitude },
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    logger.error('Update driver location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/drivers/:id/availability
// @desc    Update driver availability
router.put('/:id/availability', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    const driver = await Driver.findById(id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check authorization
    if (driver._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update availability'
      });
    }

    // Don't allow driver to go offline if they have an active order
    if (!isAvailable && driver.currentOrder) {
      return res.status(400).json({
        success: false,
        message: 'Cannot go offline while having an active order'
      });
    }

    driver.isAvailable = isAvailable;
    await driver.save();

    res.json({
      success: true,
      data: { isAvailable },
      message: 'Availability updated successfully'
    });
  } catch (error) {
    logger.error('Update driver availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/drivers/:id/orders
// @desc    Get driver's order history
router.get('/:id/orders', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Check authorization
    if (id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these orders'
      });
    }

    let query = { driver: id };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('restaurant', 'name address')
      .populate('user', 'name phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get driver orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/drivers/:id/earnings
// @desc    Get driver's earnings summary
router.get('/:id/earnings', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { period = 'month' } = req.query;

    // Check authorization
    if (id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view earnings'
      });
    }

    const driver = await Driver.findById(id);
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get completed orders in the period
    const orders = await Order.find({
      driver: id,
      status: 'delivered',
      deliveredAt: { $gte: startDate }
    }).select('totalAmount deliveryFee deliveredAt');

    const totalEarnings = orders.reduce((sum, order) => {
      return sum + (order.driverEarnings || 0);
    }, 0);

    const totalOrders = orders.length;
    const averagePerOrder = totalOrders > 0 ? totalEarnings / totalOrders : 0;

    res.json({
      success: true,
      data: {
        period,
        totalEarnings,
        totalOrders,
        averagePerOrder,
        currentBalance: driver.currentBalance,
        totalWithdrawn: driver.totalWithdrawn
      }
    });
  } catch (error) {
    logger.error('Get driver earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
