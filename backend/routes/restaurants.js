const express = require('express');
const Restaurant = require('../models/Restaurant');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/restaurants
// @desc    Get all restaurants with filters
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      cuisine, 
      rating, 
      priceRange, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = {};
    
    if (cuisine) {
      query.cuisineType = { $in: cuisine.split(',') };
    }
    
    if (rating) {
      query.averageRating = { $gte: parseFloat(rating) };
    }
    
    if (priceRange) {
      query.priceRange = { $in: priceRange.split(',') };
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { cuisineType: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const restaurants = await Restaurant.find(query)
      .select('name image cuisineType priceRange averageRating deliveryTime deliveryFee')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Restaurant.countDocuments(query);

    res.json({
      success: true,
      data: {
        restaurants,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get restaurants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/restaurants/nearby
// @desc    Get nearby restaurants based on user location
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const restaurants = await Restaurant.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(radius) * 1000
        }
      }
    }).select('name image cuisineType priceRange averageRating deliveryTime deliveryFee location');

    res.json({
      success: true,
      data: restaurants
    });
  } catch (error) {
    logger.error('Get nearby restaurants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/restaurants/:id
// @desc    Get restaurant details
router.get('/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
      .populate('menu.category', 'name')
      .select('-password -owner.bankAccount');

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    res.json({
      success: true,
      data: restaurant
    });
  } catch (error) {
    logger.error('Get restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/restaurants/:id/menu
// @desc    Get restaurant menu
router.get('/:id/menu', async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = { _id: req.params.id };
    if (category) {
      query['menu.category'] = category;
    }

    const restaurant = await Restaurant.findById(req.params.id)
      .select('menu categories')
      .populate('menu.category', 'name');

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    res.json({
      success: true,
      data: restaurant.menu
    });
  } catch (error) {
    logger.error('Get restaurant menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/restaurants
// @desc    Create new restaurant (restaurant owner only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      description,
      cuisineType,
      address,
      phone,
      email,
      deliveryFee,
      deliveryTime,
      priceRange
    } = req.body;

    // Check if user is a restaurant owner
    if (req.user.role !== 'restaurant_owner') {
      return res.status(403).json({
        success: false,
        message: 'Only restaurant owners can create restaurants'
      });
    }

    const restaurant = new Restaurant({
      name,
      description,
      cuisineType,
      address,
      phone,
      email,
      deliveryFee,
      deliveryTime,
      priceRange,
      owner: req.user.id
    });

    await restaurant.save();

    res.status(201).json({
      success: true,
      data: restaurant,
      message: 'Restaurant created successfully'
    });
  } catch (error) {
    logger.error('Create restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/restaurants/:id
// @desc    Update restaurant (owner only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Check if user is the owner
    if (restaurant.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only restaurant owner can update restaurant'
      });
    }

    const updates = req.body;
    Object.assign(restaurant, updates);
    await restaurant.save();

    res.json({
      success: true,
      data: restaurant,
      message: 'Restaurant updated successfully'
    });
  } catch (error) {
    logger.error('Update restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/restaurants/:id/reviews
// @desc    Add review to restaurant
router.post('/:id/reviews', authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    
    const restaurant = await Restaurant.findById(req.params.id);
    
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    const review = {
      user: req.user.id,
      rating,
      comment,
      createdAt: new Date()
    };

    restaurant.reviews.push(review);
    await restaurant.save();

    // Update average rating
    const totalReviews = restaurant.reviews.length;
    const sumRatings = restaurant.reviews.reduce((sum, r) => sum + r.rating, 0);
    restaurant.averageRating = sumRatings / totalReviews;
    await restaurant.save();

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review added successfully'
    });
  } catch (error) {
    logger.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
