const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  items: [{
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    customizations: [{
      name: String,
      options: [String]
    }],
    specialInstructions: String
  }],
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    deliveryFee: {
      type: Number,
      required: true,
      min: 0
    },
    serviceFee: {
      type: Number,
      required: true,
      min: 0
    },
    tax: {
      type: Number,
      required: true,
      min: 0
    },
    tip: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },
  deliveryAddress: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    coordinates: {
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      }
    },
    instructions: String
  },
  status: {
    type: String,
    enum: [
      'pending', 'confirmed', 'preparing', 'ready', 
      'picked_up', 'on_the_way', 'delivered', 'cancelled', 'refunded'
    ],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'paypal', 'cash'],
    required: true
  },
  paymentDetails: {
    stripePaymentIntentId: String,
    lastFour: String,
    brand: String,
    transactionId: String
  },
  estimatedDeliveryTime: Date,
  actualDeliveryTime: Date,
  preparationTime: {
    estimated: Number, // minutes
    actual: Number // minutes
  },
  deliveryTime: {
    estimated: Number, // minutes
    actual: Number // minutes
  },
  tracking: {
    driverLocation: {
      lat: Number,
      lng: Number,
      timestamp: Date
    },
    lastUpdate: {
      type: Date,
      default: Date.now
    },
    estimatedArrival: Date
  },
  statusHistory: [{
    status: {
      type: String,
      enum: [
        'pending', 'confirmed', 'preparing', 'ready', 
        'picked_up', 'on_the_way', 'delivered', 'cancelled', 'refunded'
      ]
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  groupOrder: {
    isGroupOrder: {
      type: Boolean,
      default: false
    },
    groupId: mongoose.Schema.Types.ObjectId,
    organizerId: mongoose.Schema.Types.ObjectId,
    participants: [{
      userId: mongoose.Schema.Types.ObjectId,
      items: [mongoose.Schema.Types.Mixed],
      paid: {
        type: Boolean,
        default: false
      }
    }]
  },
  scheduledOrder: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    scheduledTime: Date,
    reminderSent: {
      type: Boolean,
      default: false
    }
  },
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    images: [String],
    helpfulCount: {
      type: Number,
      default: 0
    },
    createdAt: Date
  },
  issues: [{
    type: {
      type: String,
      enum: ['late_delivery', 'wrong_items', 'cold_food', 'missing_items', 'damaged_items', 'other']
    },
    description: String,
    images: [String],
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'rejected'],
      default: 'pending'
    },
    resolution: String,
    refundAmount: Number,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  loyalty: {
    pointsEarned: {
      type: Number,
      default: 0
    },
    pointsUsed: {
      type: Number,
      default: 0
    },
    rewardsApplied: [{
      type: String,
      value: Number
    }]
  },
  notes: {
    customerNotes: String,
    restaurantNotes: String,
    driverNotes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for order duration
orderSchema.virtual('orderDuration').get(function() {
  if (this.actualDeliveryTime && this.createdAt) {
    return Math.round((this.actualDeliveryTime - this.createdAt) / (1000 * 60)); // minutes
  }
  return null;
});

// Virtual for order status progression
orderSchema.virtual('statusProgress').get(function() {
  const statusOrder = [
    'pending', 'confirmed', 'preparing', 'ready', 
    'picked_up', 'on_the_way', 'delivered'
  ];
  const currentIndex = statusOrder.indexOf(this.status);
  return {
    current: this.status,
    currentIndex,
    totalSteps: statusOrder.length,
    percentage: Math.round(((currentIndex + 1) / statusOrder.length) * 100)
  };
});

// Indexes for performance
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1 });
orderSchema.index({ driverId: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'deliveryAddress.coordinates': '2dsphere' });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ 'groupOrder.isGroupOrder': 1 });
orderSchema.index({ 'scheduledOrder.isScheduled': 1, 'scheduledOrder.scheduledTime': 1 });

// Pre-save middleware to update status history
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }
  next();
});

// Pre-save middleware to calculate total
orderSchema.pre('save', function(next) {
  if (this.isModified('pricing.subtotal') || this.isModified('pricing.deliveryFee') || 
      this.isModified('pricing.serviceFee') || this.isModified('pricing.tax') || 
      this.isModified('pricing.tip') || this.isModified('pricing.discount')) {
    
    this.pricing.total = this.pricing.subtotal + 
                        this.pricing.deliveryFee + 
                        this.pricing.serviceFee + 
                        this.pricing.tax + 
                        this.pricing.tip - 
                        this.pricing.discount;
  }
  next();
});

// Instance method to update status with history
orderSchema.methods.updateStatus = function(newStatus, note, updatedBy) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note,
    updatedBy
  });
  
  // Set actual delivery time when delivered
  if (newStatus === 'delivered') {
    this.actualDeliveryTime = new Date();
  }
  
  return this.save();
};

// Instance method to add issue
orderSchema.methods.addIssue = function(issueData) {
  this.issues.push({
    ...issueData,
    createdAt: new Date()
  });
  return this.save();
};

// Instance method to calculate loyalty points
orderSchema.methods.calculateLoyaltyPoints = function() {
  const basePoints = Math.floor(this.pricing.total * 10); // 1 point per $0.10 spent
  const bonusPoints = this.pricing.total > 50 ? 50 : 0; // Bonus for orders over $50
  this.loyalty.pointsEarned = basePoints + bonusPoints;
  return this.loyalty.pointsEarned;
};

// Static method to get order statistics
orderSchema.statics.getStats = async function(filters = {}) {
  const matchStage = { ...filters };
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.total' },
        averageOrderValue: { $avg: '$pricing.total' },
        ordersByStatus: {
          $push: {
            status: '$status',
            count: 1
          }
        },
        ordersByPaymentMethod: {
          $push: {
            method: '$paymentMethod',
            count: 1
          }
        }
      }
    },
    {
      $addFields: {
        statusDistribution: {
          $arrayToObject: {
            $map: {
              input: '$ordersByStatus',
              as: 'item',
              in: [ '$$item.status', { $sum: '$$item.count' } ]
            }
          }
        },
        paymentMethodDistribution: {
          $arrayToObject: {
            $map: {
              input: '$ordersByPaymentMethod',
              as: 'item',
              in: [ '$$item.method', { $sum: '$$item.count' } ]
            }
          }
        }
      }
    },
    {
      $project: {
        ordersByStatus: 0,
        ordersByPaymentMethod: 0
      }
    }
  ]);

  return stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    statusDistribution: {},
    paymentMethodDistribution: {}
  };
};

// Static method to get driver performance stats
orderSchema.statics.getDriverStats = async function(driverId, dateRange) {
  const matchStage = { driverId };
  
  if (dateRange && dateRange.start && dateRange.end) {
    matchStage.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$driverId',
        totalOrders: { $sum: 1 },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        averageDeliveryTime: { $avg: '$deliveryTime.actual' },
        totalEarnings: { $sum: '$pricing.deliveryFee' },
        averageRating: { $avg: '$review.rating' }
      }
    }
  ]);

  return stats[0] || {
    totalOrders: 0,
    completedOrders: 0,
    averageDeliveryTime: 0,
    totalEarnings: 0,
    averageRating: 0
  };
};

module.exports = mongoose.model('Order', orderSchema);
