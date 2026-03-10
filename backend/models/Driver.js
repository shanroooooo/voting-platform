const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  vehicle: {
    type: {
      type: String,
      enum: ['car', 'motorcycle', 'bicycle', 'scooter', 'truck'],
      required: true
    },
    make: {
      type: String,
      required: true
    },
    model: {
      type: String,
      required: true
    },
    year: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 1
    },
    color: String,
    licensePlate: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    photos: [String],
    insurance: {
      policyNumber: String,
      company: String,
      expirationDate: Date,
      documents: [String]
    },
    registration: {
      number: String,
      expirationDate: Date,
      documents: [String]
    }
  },
  license: {
    number: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    expirationDate: {
      type: Date,
      required: true
    },
    issuingState: {
      type: String,
      required: true
    },
    documents: [String]
  },
  availability: {
    isOnline: {
      type: Boolean,
      default: false
    },
    currentLocation: {
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    },
    workingHours: {
      monday: { start: String, end: String, available: { type: Boolean, default: true } },
      tuesday: { start: String, end: String, available: { type: Boolean, default: true } },
      wednesday: { start: String, end: String, available: { type: Boolean, default: true } },
      thursday: { start: String, end: String, available: { type: Boolean, default: true } },
      friday: { start: String, end: String, available: { type: Boolean, default: true } },
      saturday: { start: String, end: String, available: { type: Boolean, default: true } },
      sunday: { start: String, end: String, available: { type: Boolean, default: true } }
    },
    preferredAreas: [{
      type: String,
      coordinates: {
        lat: Number,
        lng: Number
      },
      radius: Number // miles
    }],
    maxDeliveryRadius: {
      type: Number,
      default: 10, // miles
      min: 1,
      max: 50
    }
  },
  stats: {
    totalOrders: {
      type: Number,
      default: 0
    },
    completedOrders: {
      type: Number,
      default: 0
    },
    cancelledOrders: {
      type: Number,
      default: 0
    },
    totalEarnings: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatingCount: {
      type: Number,
      default: 0
    },
    averageDeliveryTime: {
      type: Number,
      default: 0
    },
    onTimeDeliveryRate: {
      type: Number,
      default: 0
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    }
  },
  currentOrder: {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    status: {
      type: String,
      enum: ['assigned', 'picked_up', 'on_the_way', 'delivered'],
      default: null
    },
    assignedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date
  },
  ratings: [{
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    userId: {
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
    comment: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  documents: {
    profilePhoto: String,
    idDocument: String,
    backgroundCheck: {
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      completedAt: Date,
      expiresAt: Date,
      documents: [String]
    },
    vehicleInspection: {
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      completedAt: Date,
      expiresAt: Date,
      documents: [String]
    }
  },
  banking: {
    accountHolderName: String,
    bankName: String,
    accountNumber: String,
    routingNumber: String,
    accountType: {
      type: String,
      enum: ['checking', 'savings']
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  preferences: {
    orderTypes: [{
      type: String,
      enum: ['standard', 'express', 'scheduled', 'bulk']
    }],
    restaurants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant'
    }],
    avoidRestaurants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant'
    }],
    maxOrdersPerShift: {
      type: Number,
      default: 10,
      min: 1
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  suspensionReason: String,
  suspensionEndDate: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for driver's orders
driverSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'driverId'
});

// Virtual for completion rate
driverSchema.virtual('completionRate').get(function() {
  if (this.stats.totalOrders === 0) return 0;
  return Math.round((this.stats.completedOrders / this.stats.totalOrders) * 100);
});

// Virtual for current earnings (this month)
driverSchema.virtual('currentMonthEarnings').get(function() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // This would typically be calculated from actual orders
  // For now, return a placeholder
  return 0;
});

// Indexes for performance
driverSchema.index({ userId: 1 });
driverSchema.index({ 'availability.currentLocation': '2dsphere' });
driverSchema.index({ 'availability.isOnline': 1 });
driverSchema.index({ 'verificationStatus': 1 });
driverSchema.index({ 'stats.averageRating': -1 });
driverSchema.index({ isActive: 1 });

// Pre-save middleware to update stats
driverSchema.pre('save', function(next) {
  if (this.isModified('ratings')) {
    this.updateRatingStats();
  }
  next();
});

// Instance method to update location
driverSchema.methods.updateLocation = function(lat, lng) {
  this.availability.currentLocation = {
    lat,
    lng,
    timestamp: new Date()
  };
  return this.save();
};

// Instance method to go online/offline
driverSchema.methods.setOnlineStatus = function(isOnline) {
  this.availability.isOnline = isOnline;
  if (!isOnline) {
    this.currentOrder = null;
  }
  return this.save();
};

// Instance method to accept order
driverSchema.methods.acceptOrder = function(orderId) {
  this.currentOrder = {
    orderId,
    status: 'assigned',
    assignedAt: new Date()
  };
  this.stats.totalOrders += 1;
  return this.save();
};

// Instance method to update order status
driverSchema.methods.updateOrderStatus = function(status) {
  if (!this.currentOrder) return this;
  
  this.currentOrder.status = status;
  
  switch (status) {
    case 'picked_up':
      this.currentOrder.pickedUpAt = new Date();
      break;
    case 'delivered':
      this.currentOrder.deliveredAt = new Date();
      this.stats.completedOrders += 1;
      this.currentOrder = null;
      break;
  }
  
  return this.save();
};

// Instance method to add rating
driverSchema.methods.addRating = function(orderId, userId, rating, comment) {
  this.ratings.push({
    orderId,
    userId,
    rating,
    comment,
    timestamp: new Date()
  });
  
  this.updateRatingStats();
  return this.save();
};

// Instance method to update rating stats
driverSchema.methods.updateRatingStats = function() {
  if (this.ratings.length === 0) {
    this.stats.averageRating = 0;
    this.stats.totalRatingCount = 0;
    return;
  }
  
  const totalRating = this.ratings.reduce((sum, r) => sum + r.rating, 0);
  this.stats.averageRating = Math.round((totalRating / this.ratings.length) * 10) / 10;
  this.stats.totalRatingCount = this.ratings.length;
};

// Instance method to check if available for order
driverSchema.methods.isAvailableForOrder = function(orderLocation, orderType) {
  if (!this.availability.isOnline) return false;
  if (this.currentOrder && this.currentOrder.orderId) return false;
  if (!this.isActive || this.verificationStatus !== 'approved') return false;
  
  // Check if order is within delivery radius
  const distance = this.calculateDistance(
    this.availability.currentLocation,
    orderLocation
  );
  
  if (distance > this.availability.maxDeliveryRadius) return false;
  
  // Check if order type is preferred
  if (this.preferences.orderTypes.length > 0 && 
      !this.preferences.orderTypes.includes(orderType)) {
    return false;
  }
  
  return true;
};

// Instance method to calculate distance (simplified)
driverSchema.methods.calculateDistance = function(point1, point2) {
  const R = 3959; // Earth's radius in miles
  const dLat = this.toRad(point2.lat - point1.lat);
  const dLon = this.toRad(point2.lng - point1.lng);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

driverSchema.methods.toRad = function(value) {
  return value * Math.PI / 180;
};

// Static method to find available drivers
driverSchema.statics.findAvailableDrivers = function(orderLocation, orderType = 'standard') {
  return this.find({
    'availability.isOnline': true,
    isActive: true,
    verificationStatus: 'approved',
    currentOrder: null
  }).populate('userId', 'name phone email');
};

// Static method to get driver statistics
driverSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalDrivers: { $sum: 1 },
        activeDrivers: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        onlineDrivers: {
          $sum: { $cond: [{ $eq: ['$availability.isOnline', true] }, 1, 0] }
        },
        verifiedDrivers: {
          $sum: { $cond: [{ $eq: ['$verificationStatus', 'approved'] }, 1, 0] }
        },
        averageRating: { $avg: '$stats.averageRating' },
        totalOrders: { $sum: '$stats.totalOrders' },
        totalEarnings: { $sum: '$stats.totalEarnings' }
      }
    }
  ]);

  return stats[0] || {
    totalDrivers: 0,
    activeDrivers: 0,
    onlineDrivers: 0,
    verifiedDrivers: 0,
    averageRating: 0,
    totalOrders: 0,
    totalEarnings: 0
  };
};

module.exports = mongoose.model('Driver', driverSchema);
