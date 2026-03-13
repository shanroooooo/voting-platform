const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { validateUser } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
router.put('/profile', [authMiddleware, validateUser], async (req, res) => {
  try {
    const { name, email, phone, addresses, preferences } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, phone, addresses, preferences },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/orders
// @desc    Get user's order history
router.get('/orders', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { user: req.user.id };
    
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

// @route   POST /api/users/addresses
// @desc    Add new address
router.post('/addresses', authMiddleware, async (req, res) => {
  try {
    const { street, city, state, zipCode, country, isDefault } = req.body;
    
    const user = await User.findById(req.user.id);
    
    const newAddress = {
      street,
      city,
      state,
      zipCode,
      country,
      isDefault: isDefault || false
    };

    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    user.addresses.push(newAddress);
    await user.save();

    res.json({
      success: true,
      data: newAddress,
      message: 'Address added successfully'
    });
  } catch (error) {
    logger.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/addresses/:addressId
// @desc    Update address
router.put('/addresses/:addressId', authMiddleware, async (req, res) => {
  try {
    const { addressId } = req.params;
    const updates = req.body;
    
    const user = await User.findById(req.user.id);
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    
    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    if (updates.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    Object.assign(user.addresses[addressIndex], updates);
    await user.save();

    res.json({
      success: true,
      data: user.addresses[addressIndex],
      message: 'Address updated successfully'
    });
  } catch (error) {
    logger.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/users/addresses/:addressId
// @desc    Delete address
router.delete('/addresses/:addressId', authMiddleware, async (req, res) => {
  try {
    const { addressId } = req.params;
    
    const user = await User.findById(req.user.id);
    user.addresses = user.addresses.filter(addr => addr._id.toString() !== addressId);
    await user.save();

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    logger.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
