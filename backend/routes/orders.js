const express = require('express');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const Driver = require('../models/Driver');
const { authMiddleware } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

// @route   POST /api/orders
// @desc    Create new order
router.post('/', [authMiddleware, validateOrder], async (req, res) => {
  try {
    const {
      restaurant,
      items,
      deliveryAddress,
      paymentMethod,
      specialInstructions
    } = req.body;

    // Validate restaurant
    const restaurantDoc = await Restaurant.findById(restaurant);
    if (!restaurantDoc) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Calculate total amount
    let subtotal = 0;
    for (const item of items) {
      const menuItem = restaurantDoc.menu.id(item.menuItem);
      if (!menuItem) {
        return res.status(400).json({
          success: false,
          message: `Menu item ${item.menuItem} not found`
        });
      }
      subtotal += menuItem.price * item.quantity;
    }

    const deliveryFee = restaurantDoc.deliveryFee;
    const totalAmount = subtotal + deliveryFee;

    // Create order
    const order = new Order({
      user: req.user.id,
      restaurant,
      items,
      deliveryAddress,
      paymentMethod,
      specialInstructions,
      subtotal,
      deliveryFee,
      totalAmount,
      status: 'pending'
    });

    await order.save();

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('new-order', {
      orderId: order._id,
      restaurant: restaurantDoc.name,
      totalAmount: order.totalAmount
    });

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (error) {
    logger.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/orders/:id
// @desc    Get order details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('restaurant', 'name phone address')
      .populate('user', 'name phone')
      .populate('driver', 'name phone vehicle');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Validate status transition
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['picked_up'],
      'picked_up': ['delivered'],
      'delivered': [],
      'cancelled': []
    };

    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${order.status} to ${status}`
      });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      updatedBy: req.user.id
    });

    if (status === 'delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();

    // Emit real-time status update
    const io = req.app.get('io');
    io.to(`order-${id}`).emit('status-update', {
      orderId: id,
      status,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: order,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    logger.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/orders/:id/assign-driver
// @desc    Assign driver to order
router.post('/:id/assign-driver', authMiddleware, async (req, res) => {
  try {
    const { driverId } = req.body;
    const { id } = req.params;

    const order = await Order.findById(id);
    const driver = await Driver.findById(driverId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    if (!driver.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Driver is not available'
      });
    }

    order.driver = driverId;
    order.status = 'confirmed';
    await order.save();

    // Update driver availability
    driver.isAvailable = false;
    driver.currentOrder = id;
    await driver.save();

    // Emit real-time events
    const io = req.app.get('io');
    io.to(`order-${id}`).emit('driver-assigned', {
      orderId: id,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        vehicle: driver.vehicle
      }
    });

    res.json({
      success: true,
      data: order,
      message: 'Driver assigned successfully'
    });
  } catch (error) {
    logger.error('Assign driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/orders/user/:userId
// @desc    Get user's orders
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Check authorization
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these orders'
      });
    }

    let query = { user: userId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('restaurant', 'name image')
      .populate('driver', 'name phone')
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
    logger.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/orders/driver/:driverId
// @desc    Get driver's orders
router.get('/driver/:driverId', authMiddleware, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Check authorization
    if (driverId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these orders'
      });
    }

    let query = { driver: driverId };
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

// @route   POST /api/orders/:id/cancel
// @desc    Cancel order
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    // Check authorization
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    order.status = 'cancelled';
    order.cancellationReason = reason;
    order.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      updatedBy: req.user.id
    });

    // If driver was assigned, make them available again
    if (order.driver) {
      await Driver.findByIdAndUpdate(order.driver, {
        isAvailable: true,
        currentOrder: null
      });
    }

    await order.save();

    // Emit real-time cancellation
    const io = req.app.get('io');
    io.to(`order-${id}`).emit('order-cancelled', {
      orderId: id,
      reason,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: order,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    logger.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
