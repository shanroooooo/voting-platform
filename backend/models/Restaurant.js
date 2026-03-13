const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Restaurant name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cuisine: {
    type: String,
    required: [true, 'Cuisine type is required'],
    enum: [
      'american', 'italian', 'chinese', 'japanese', 'mexican',
      'indian', 'thai', 'korean', 'french', 'greek', 'mediterranean',
      'spanish', 'vietnamese', 'middle-eastern', 'african', 'caribbean',
      'fusion', 'cafe', 'bakery', 'fast-food', 'pizza', 'burger',
      'sushi', 'barbecue', 'vegetarian', 'vegan', 'desserts'
    ]
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(v) {
          return v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && // longitude
                 v[1] >= -90 && v[1] <= 90;     // latitude
        },
        message: 'Coordinates must be [longitude, latitude] in valid ranges'
      }
    }
  },
  contact: {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    website: String
  },
  menu: [{
    category: {
      type: String,
      required: true
    },
    items: [{
      name: {
        type: String,
        required: true,
        maxlength: [100, 'Item name cannot exceed 100 characters']
      },
      description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
      },
      price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
      },
      image: {
        type: String,
        default: ''
      },
      dietaryInfo: [{
        type: String,
        enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'halal', 'kosher']
      }],
      preparationTime: {
        type: Number,
        default: 15, // minutes
        min: 1
      },
      isAvailable: {
        type: Boolean,
        default: true
      },
      ingredients: [{
        type: String,
        maxlength: [50, 'Ingredient name cannot exceed 50 characters']
      }],
      allergens: [{
        type: String,
        enum: ['milk', 'eggs', 'fish', 'shellfish', 'tree nuts', 'peanuts', 'wheat', 'soybeans']
      }],
      spicyLevel: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
      },
      calories: Number,
      customizations: [{
        name: String,
        options: [{
          name: String,
          price: Number,
          isDefault: Boolean
        }]
      }]
    }]
  }],
  operatingHours: {
    monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    sunday: { open: String, close: String, isOpen: { type: Boolean, default: true } }
  },
  deliveryInfo: {
    averageTime: {
      type: Number,
      default: 30, // minutes
      min: 10
    },
    deliveryFee: {
      type: Number,
      default: 2.99,
      min: 0
    },
    minimumOrder: {
      type: Number,
      default: 10.00,
      min: 0
    },
    deliveryRadius: {
      type: Number,
      default: 5, // miles
      min: 1
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 25.00,
      min: 0
    }
  },
  images: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v) || /^\/uploads\/.+/.test(v);
      },
      message: 'Image must be a valid URL or local path'
    }
  }],
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: [1000, 'Review cannot exceed 1000 characters']
    },
    images: [String],
    helpful: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  stats: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    popularItems: [{
      itemName: String,
      orderCount: Number
    }]
  },
  features: [{
    type: String,
    enum: [
      'outdoor-seating', 'delivery', 'takeout', 'reservations',
      'wifi', 'parking', 'wheelchair-accessible', 'pet-friendly',
      'alcohol', 'kids-menu', 'catering', 'late-night', 'breakfast',
      'lunch', 'dinner', 'brunch', 'happy-hour'
    ]
  }],
  priceRange: {
    type: String,
    enum: ['$', '$$', '$$$', '$$$$'],
    default: '$$'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDocuments: [{
    type: String
  }],
  commissionRate: {
    type: Number,
    default: 0.15, // 15%
    min: 0,
    max: 0.5
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for restaurant's orders
restaurantSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'restaurant'
});

// Virtual for restaurant's menu items count
restaurantSchema.virtual('menuItemCount').get(function() {
  let count = 0;
  this.menu.forEach(category => {
    count += category.items.length;
  });
  return count;
});

// Virtual for current status (open/closed)
restaurantSchema.virtual('isOpen').get(function() {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const todayHours = this.operatingHours[day];
  if (!todayHours || !todayHours.isOpen) return false;
  
  if (!todayHours.open || !todayHours.close) return false;
  
  const openTime = this.timeToMinutes(todayHours.open);
  const closeTime = this.timeToMinutes(todayHours.close);
  
  return currentTime >= openTime && currentTime <= closeTime;
});

// Indexes for performance
restaurantSchema.index({ name: 'text', 'menu.items.name': 'text' });
restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ cuisine: 1 });
restaurantSchema.index({ 'rating.average': -1 });
restaurantSchema.index({ isActive: 1 });
restaurantSchema.index({ owner: 1 });

// Instance method to convert time string to minutes
restaurantSchema.methods.timeToMinutes = function(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Instance method to update rating
restaurantSchema.methods.updateRating = async function() {
  const stats = await this.model('Restaurant').aggregate([
    { $match: { _id: this._id } },
    { $unwind: '$reviews' },
    {
      $group: {
        _id: '$_id',
        averageRating: { $avg: '$reviews.rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    this.rating.average = Math.round(stats[0].averageRating * 10) / 10;
    this.rating.count = stats[0].reviewCount;
    await this.save();
  }
};

// Instance method to get popular items
restaurantSchema.methods.getPopularItems = function(limit = 5) {
  const allItems = [];
  this.menu.forEach(category => {
    category.items.forEach(item => {
      allItems.push({
        ...item.toObject(),
        category: category.name
      });
    });
  });
  
  return allItems
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, limit);
};

// Static method to find nearby restaurants
restaurantSchema.statics.findNearby = function(coordinates, maxDistance = 5) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates.lng, coordinates.lat]
        },
        $maxDistance: maxDistance * 1609.34 // Convert miles to meters
      }
    },
    isActive: true
  });
};

// Static method to search restaurants
restaurantSchema.statics.search = function(query, filters = {}) {
  const searchQuery = {
    isActive: true,
    ...filters
  };

  if (query) {
    searchQuery.$text = { $search: query };
  }

  return this.find(searchQuery)
    .populate('owner', 'name email')
    .sort({ rating: { average: -1 }, 'reviews.length': -1 });
};

// Static method to get restaurant statistics
restaurantSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalRestaurants: { $sum: 1 },
        activeRestaurants: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        verifiedRestaurants: {
          $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
        },
        averageRating: { $avg: '$rating.average' }
      }
    }
  ]);

  return stats[0] || {
    totalRestaurants: 0,
    activeRestaurants: 0,
    verifiedRestaurants: 0,
    averageRating: 0
  };
};

module.exports = mongoose.model('Restaurant', restaurantSchema);
