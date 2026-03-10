const mongoose = require('mongoose');

const groupOrderSchema = new mongoose.Schema({
  organizerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: [100, 'Group order name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  deadline: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value > new Date(Date.now() + 15 * 60 * 1000); // Must be at least 15 minutes in future
      },
      message: 'Deadline must be at least 15 minutes in the future'
    }
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'processing', 'completed', 'cancelled'],
    default: 'active'
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
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
      customizations: [String],
      specialInstructions: String
    }],
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    paid: {
      type: Boolean,
      default: false
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'paypal', 'cash']
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],
  orderSettings: {
    maxParticipants: {
      type: Number,
      default: 20,
      min: 2,
      max: 100
    },
    minParticipants: {
      type: Number,
      default: 2,
      min: 1
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0
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
    splitDeliveryFee: {
      type: Boolean,
      default: true
    },
    allowEdits: {
      type: Boolean,
      default: true
    },
    autoClose: {
      type: Boolean,
      default: false
    },
    requireApproval: {
      type: Boolean,
      default: false
    }
  },
  pricing: {
    subtotal: {
      type: Number,
      default: 0,
      min: 0
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0
    },
    serviceFee: {
      type: Number,
      default: 0,
      min: 0
    },
    tax: {
      type: Number,
      default: 0,
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
      default: 0,
      min: 0
    }
  },
  shareLink: {
    type: String,
    unique: true
  },
  shareCode: {
    type: String,
    unique: true
  },
  notifications: {
    deadlineReminderSent: {
      type: Boolean,
      default: false
    },
    finalReminderSent: {
      type: Boolean,
      default: false
    },
    orderPlacedNotificationSent: {
      type: Boolean,
      default: false
    }
  },
  activity: [{
    type: {
      type: String,
      enum: ['created', 'joined', 'left', 'updated_items', 'paid', 'closed', 'cancelled'],
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed
  }],
  convertedToOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  notes: {
    organizerNotes: String,
    restaurantNotes: String,
    deliveryNotes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
groupOrderSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

groupOrderSchema.virtual('paidParticipants').get(function() {
  return this.participants.filter(p => p.paid).length;
});

groupOrderSchema.virtual('unpaidParticipants').get(function() {
  return this.participants.filter(p => !p.paid);
});

groupOrderSchema.virtual('allParticipantsPaid').get(function() {
  return this.participants.length > 0 && this.participants.every(p => p.paid);
});

groupOrderSchema.virtual('timeUntilDeadline').get(function() {
  return this.deadline - new Date();
});

groupOrderSchema.virtual('canJoin').get(function() {
  return this.participants.length < this.orderSettings.maxParticipants &&
         this.status === 'active' &&
         new Date() < this.deadline;
});

groupOrderSchema.virtual('isExpired').get(function() {
  return new Date() > this.deadline && this.status === 'active';
});

groupOrderSchema.virtual('meetsMinParticipants').get(function() {
  return this.participants.length >= this.orderSettings.minParticipants;
});

// Indexes
groupOrderSchema.index({ organizerId: 1, createdAt: -1 });
groupOrderSchema.index({ restaurantId: 1, status: 1 });
groupOrderSchema.index({ 'participants.userId': 1 });
groupOrderSchema.index({ deadline: 1, status: 1 });
groupOrderSchema.index({ shareLink: 1 });
groupOrderSchema.index({ shareCode: 1 });
groupOrderSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware
groupOrderSchema.pre('save', function(next) {
  // Generate share link and code if not exists
  if (!this.shareLink) {
    this.shareLink = this.generateShareLink();
  }
  
  if (!this.shareCode) {
    this.shareCode = this.generateShareCode();
  }
  
  // Calculate total pricing
  if (this.isModified('participants') || this.isModified('pricing')) {
    this.calculatePricing();
  }
  
  // Check if deadline passed and auto-close
  if (this.orderSettings.autoClose && this.isExpired && this.status === 'active') {
    this.status = 'closed';
  }
  
  next();
});

// Instance methods
groupOrderSchema.methods.addParticipant = function(userId, items, paymentMethod) {
  // Check if user is already a participant
  if (this.participants.some(p => p.userId.toString() === userId.toString())) {
    throw new Error('User is already a participant');
  }
  
  // Check if max participants reached
  if (this.participants.length >= this.orderSettings.maxParticipants) {
    throw new Error('Maximum participants reached');
  }
  
  // Check if deadline passed
  if (this.isExpired) {
    throw new Error('Group order deadline has passed');
  }
  
  // Calculate subtotal for this participant
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);
  
  // Add participant
  this.participants.push({
    userId,
    items,
    subtotal,
    paymentMethod,
    paid: false,
    joinedAt: new Date(),
    lastUpdated: new Date()
  });
  
  // Add activity log
  this.activity.push({
    type: 'joined',
    userId,
    timestamp: new Date(),
    details: { itemCount: items.length, subtotal }
  });
  
  return this.save();
};

groupOrderSchema.methods.removeParticipant = function(userId) {
  const participantIndex = this.participants.findIndex(
    p => p.userId.toString() === userId.toString()
  );
  
  if (participantIndex === -1) {
    throw new Error('Participant not found');
  }
  
  // Remove participant
  this.participants.splice(participantIndex, 1);
  
  // Add activity log
  this.activity.push({
    type: 'left',
    userId,
    timestamp: new Date()
  });
  
  // If no participants left, cancel the group order
  if (this.participants.length === 0) {
    this.status = 'cancelled';
  }
  
  return this.save();
};

groupOrderSchema.methods.updateParticipantItems = function(userId, items) {
  if (!this.orderSettings.allowEdits) {
    throw new Error('Edits are not allowed for this group order');
  }
  
  const participant = this.participants.find(
    p => p.userId.toString() === userId.toString()
  );
  
  if (!participant) {
    throw new Error('Participant not found');
  }
  
  // Calculate new subtotal
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);
  
  // Update items and subtotal
  participant.items = items;
  participant.subtotal = subtotal;
  participant.lastUpdated = new Date();
  
  // Add activity log
  this.activity.push({
    type: 'updated_items',
    userId,
    timestamp: new Date(),
    details: { itemCount: items.length, subtotal }
  });
  
  return this.save();
};

groupOrderSchema.methods.markParticipantPaid = function(userId) {
  const participant = this.participants.find(
    p => p.userId.toString() === userId.toString()
  );
  
  if (!participant) {
    throw new Error('Participant not found');
  }
  
  participant.paid = true;
  
  // Add activity log
  this.activity.push({
    type: 'paid',
    userId,
    timestamp: new Date()
  });
  
  return this.save();
};

groupOrderSchema.methods.closeGroupOrder = function() {
  if (this.status !== 'active') {
    throw new Error('Group order is not active');
  }
  
  if (!this.meetsMinParticipants) {
    throw new Error('Minimum participants not reached');
  }
  
  this.status = 'closed';
  
  // Add activity log
  this.activity.push({
    type: 'closed',
    userId: this.organizerId,
    timestamp: new Date(),
    details: { participantCount: this.participant.length }
  });
  
  return this.save();
};

groupOrderSchema.methods.cancelGroupOrder = function(reason) {
  if (this.status === 'completed' || this.status === 'processing') {
    throw new Error('Cannot cancel completed or processing group order');
  }
  
  this.status = 'cancelled';
  
  // Add activity log
  this.activity.push({
    type: 'cancelled',
    userId: this.organizerId,
    timestamp: new Date(),
    details: { reason }
  });
  
  return this.save();
};

groupOrderSchema.methods.calculatePricing = function() {
  // Calculate subtotal from all participants
  this.pricing.subtotal = this.participants.reduce((sum, p) => sum + p.subtotal, 0);
  
  // Calculate delivery fee
  if (this.orderSettings.splitDeliveryFee && this.participants.length > 0) {
    // This would typically come from restaurant delivery info
    const baseDeliveryFee = 2.99;
    this.pricing.deliveryFee = baseDeliveryFee;
  } else {
    this.pricing.deliveryFee = 0;
  }
  
  // Calculate service fee (5% of subtotal)
  this.pricing.serviceFee = this.pricing.subtotal * 0.05;
  
  // Calculate tax (8% of subtotal + service fee)
  this.pricing.tax = (this.pricing.subtotal + this.pricing.serviceFee) * 0.08;
  
  // Calculate total
  this.pricing.total = this.pricing.subtotal + 
                      this.pricing.deliveryFee + 
                      this.pricing.serviceFee + 
                      this.pricing.tax + 
                      this.pricing.tip - 
                      this.pricing.discount;
};

groupOrderSchema.methods.convertToRegularOrder = async function() {
  if (this.status !== 'closed') {
    throw new Error('Group order must be closed before conversion');
  }
  
  const Order = mongoose.model('Order');
  
  // Create regular order from group order
  const orderData = {
    userId: this.organizerId,
    restaurantId: this.restaurantId,
    items: this.participants.flatMap(p => p.items),
    pricing: this.pricing,
    deliveryAddress: this.orderSettings.deliveryAddress,
    status: 'pending',
    paymentStatus: this.allParticipantsPaid ? 'paid' : 'pending',
    groupOrder: {
      isGroupOrder: true,
      groupId: this._id,
      organizerId: this.organizerId,
      participants: this.participants.map(p => ({
        userId: p.userId,
        items: p.items,
        paid: p.paid
      }))
    }
  };
  
  const order = new Order(orderData);
  await order.save();
  
  // Update group order
  this.convertedToOrder = order._id;
  this.status = 'completed';
  
  // Add activity log
  this.activity.push({
    type: 'completed',
    userId: this.organizerId,
    timestamp: new Date(),
    details: { orderId: order._id }
  });
  
  await this.save();
  
  return order;
};

groupOrderSchema.methods.generateShareLink = function() {
  const crypto = require('crypto');
  const uniqueId = crypto.randomBytes(8).toString('hex');
  return `${process.env.BASE_URL || 'https://fooddelivery.app'}/group-order/${uniqueId}`;
};

groupOrderSchema.methods.generateShareCode = function() {
  const crypto = require('crypto');
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

groupOrderSchema.methods.sendDeadlineReminder = function() {
  const now = new Date();
  const timeDiff = this.deadline - now;
  
  // Send reminder if it's 1 hour before and not already sent
  if (timeDiff <= 60 * 60 * 1000 && timeDiff > 0 && !this.notifications.deadlineReminderSent) {
    this.notifications.deadlineReminderSent = true;
    return this.save();
  }
  
  // Send final reminder if it's 15 minutes before and not already sent
  if (timeDiff <= 15 * 60 * 1000 && timeDiff > 0 && !this.notifications.finalReminderSent) {
    this.notifications.finalReminderSent = true;
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Static methods
groupOrderSchema.statics.findByShareCode = function(shareCode) {
  return this.findOne({ shareCode })
    .populate('organizerId participants.userId restaurantId');
};

groupOrderSchema.statics.findByShareLink = function(shareLink) {
  return this.findOne({ shareLink })
    .populate('organizerId participants.userId restaurantId');
};

groupOrderSchema.statics.findUserGroupOrders = function(userId) {
  return this.find({
    $or: [
      { organizerId: userId },
      { 'participants.userId': userId }
    ]
  }).populate('organizerId participants.userId restaurantId')
    .sort({ createdAt: -1 });
};

groupOrderSchema.statics.findActiveGroupOrders = function() {
  return this.find({
    status: 'active',
    deadline: { $gte: new Date() }
  }).populate('organizerId restaurantId')
    .sort({ deadline: 1 });
};

groupOrderSchema.statics.processExpiredOrders = async function() {
  const now = new Date();
  
  // Find expired active orders
  const expiredOrders = await this.find({
    status: 'active',
    deadline: { $lte: now }
  });
  
  const results = [];
  
  for (const order of expiredOrders) {
    try {
      if (order.orderSettings.autoClose) {
        await order.closeGroupOrder();
        results.push({
          success: true,
          groupOrderId: order._id,
          action: 'auto_closed'
        });
      } else {
        // Just mark as expired but don't close
        results.push({
          success: true,
          groupOrderId: order._id,
          action: 'expired'
        });
      }
    } catch (error) {
      results.push({
        success: false,
        groupOrderId: order._id,
        error: error.message
      });
    }
  }
  
  return results;
};

groupOrderSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalGroupOrders: { $sum: 1 },
        activeGroupOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        completedGroupOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelledGroupOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        averageParticipants: { $avg: { $size: '$participants' } },
        totalParticipants: { $sum: { $size: '$participants' } },
        totalValue: { $sum: '$pricing.total' }
      }
    }
  ]);
  
  return stats[0] || {
    totalGroupOrders: 0,
    activeGroupOrders: 0,
    completedGroupOrders: 0,
    cancelledGroupOrders: 0,
    averageParticipants: 0,
    totalParticipants: 0,
    totalValue: 0
  };
};

module.exports = mongoose.model('GroupOrder', groupOrderSchema);
