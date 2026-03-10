const mongoose = require('mongoose');

const scheduledOrderSchema = new mongoose.Schema({
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
  scheduledTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value > new Date(Date.now() + 30 * 60 * 1000); // Must be at least 30 minutes in future
      },
      message: 'Scheduled time must be at least 30 minutes in the future'
    }
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'preparing', 'ready', 'cancelled', 'completed'],
    default: 'scheduled'
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    items: [{
      name: String,
      price: Number,
      quantity: Number,
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
    }
  }],
  orderSettings: {
    maxParticipants: {
      type: Number,
      default: 10,
      min: 2,
      max: 50
    },
    minOrderAmount: {
      type: Number,
      default: 10,
      min: 0
    },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    splitDeliveryFee: {
      type: Boolean,
      default: true
    },
    allowCustomItems: {
      type: Boolean,
      default: true
    },
    autoConfirm: {
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
    total: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  notifications: {
    reminderSent: {
      type: Boolean,
      default: false
    },
    finalReminderSent: {
      type: Boolean,
      default: false
    },
    confirmationSent: {
      type: Boolean,
      default: false
    }
  },
  notes: {
    organizerNotes: String,
    restaurantNotes: String,
    deliveryNotes: String
  },
  convertedToOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
scheduledOrderSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

scheduledOrderSchema.virtual('paidParticipants').get(function() {
  return this.participants.filter(p => p.paid).length;
});

scheduledOrderSchema.virtual('allParticipantsPaid').get(function() {
  return this.participants.length > 0 && this.participants.every(p => p.paid);
});

scheduledOrderSchema.virtual('timeUntilScheduled').get(function() {
  return this.scheduledTime - new Date();
});

scheduledOrderSchema.virtual('canJoin').get(function() {
  return this.participants.length < this.orderSettings.maxParticipants &&
         this.status === 'scheduled' &&
         new Date() < this.scheduledTime;
});

// Indexes
scheduledOrderSchema.index({ organizerId: 1, scheduledTime: -1 });
scheduledOrderSchema.index({ restaurantId: 1, status: 1 });
scheduledOrderSchema.index({ 'participants.userId': 1 });
scheduledOrderSchema.index({ scheduledTime: 1, status: 1 });
scheduledOrderSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware
scheduledOrderSchema.pre('save', function(next) {
  // Calculate total pricing
  if (this.isModified('participants') || this.isModified('pricing')) {
    this.calculatePricing();
  }
  
  // Update timestamps
  this.updatedAt = new Date();
  
  next();
});

// Instance methods
scheduledOrderSchema.methods.addParticipant = function(userId, items, paymentMethod) {
  // Check if user is already a participant
  if (this.participants.some(p => p.userId.toString() === userId.toString())) {
    throw new Error('User is already a participant');
  }
  
  // Check if max participants reached
  if (this.participants.length >= this.orderSettings.maxParticipants) {
    throw new Error('Maximum participants reached');
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
    joinedAt: new Date()
  });
  
  return this.save();
};

scheduledOrderSchema.methods.removeParticipant = function(userId) {
  const participantIndex = this.participants.findIndex(
    p => p.userId.toString() === userId.toString()
  );
  
  if (participantIndex === -1) {
    throw new Error('Participant not found');
  }
  
  // Remove participant
  this.participants.splice(participantIndex, 1);
  
  // If no participants left, cancel the scheduled order
  if (this.participants.length === 0) {
    this.status = 'cancelled';
  }
  
  return this.save();
};

scheduledOrderSchema.methods.updateParticipantItems = function(userId, items) {
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
  
  return this.save();
};

scheduledOrderSchema.methods.markParticipantPaid = function(userId) {
  const participant = this.participants.find(
    p => p.userId.toString() === userId.toString()
  );
  
  if (!participant) {
    throw new Error('Participant not found');
  }
  
  participant.paid = true;
  
  // Check if all participants are paid
  if (this.allParticipantsPaid && this.orderSettings.autoConfirm) {
    this.status = 'confirmed';
  }
  
  return this.save();
};

scheduledOrderSchema.methods.calculatePricing = function() {
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
                      this.pricing.tip;
};

scheduledOrderSchema.methods.convertToRegularOrder = async function() {
  if (this.status !== 'confirmed') {
    throw new Error('Scheduled order must be confirmed before conversion');
  }
  
  const Order = mongoose.model('Order');
  
  // Create regular order from scheduled order
  const orderData = {
    userId: this.organizerId,
    restaurantId: this.restaurantId,
    items: this.participants.flatMap(p => p.items),
    pricing: this.pricing,
    deliveryAddress: this.orderSettings.deliveryAddress,
    status: 'pending',
    paymentStatus: this.allParticipantsPaid ? 'paid' : 'pending',
    scheduledOrder: {
      isScheduled: true,
      scheduledTime: this.scheduledTime,
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
  
  // Update scheduled order
  this.convertedToOrder = order._id;
  this.status = 'completed';
  await this.save();
  
  return order;
};

scheduledOrderSchema.methods.sendReminder = function() {
  const now = new Date();
  const timeDiff = this.scheduledTime - now;
  
  // Send reminder if it's 1 hour before and not already sent
  if (timeDiff <= 60 * 60 * 1000 && timeDiff > 0 && !this.notifications.reminderSent) {
    this.notifications.reminderSent = true;
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
scheduledOrderSchema.statics.findUpcomingOrders = function(minutesAhead = 60) {
  const cutoffTime = new Date(Date.now() + minutesAhead * 60 * 1000);
  
  return this.find({
    scheduledTime: { $lte: cutoffTime, $gte: new Date() },
    status: 'scheduled'
  }).populate('organizerId participants.userId restaurantId');
};

scheduledOrderSchema.statics.findUserScheduledOrders = function(userId) {
  return this.find({
    $or: [
      { organizerId: userId },
      { 'participants.userId': userId }
    ],
    scheduledTime: { $gte: new Date() },
    status: { $in: ['scheduled', 'confirmed'] }
  }).populate('organizerId participants.userId restaurantId')
    .sort({ scheduledTime: 1 });
};

scheduledOrderSchema.statics.processScheduledOrders = async function() {
  const now = new Date();
  
  // Find orders that should be processed now
  const readyOrders = await this.find({
    scheduledTime: { $lte: now },
    status: 'confirmed',
    convertedToOrder: { $exists: false }
  });
  
  const results = [];
  
  for (const order of readyOrders) {
    try {
      const convertedOrder = await order.convertToRegularOrder();
      results.push({
        success: true,
        scheduledOrderId: order._id,
        orderId: convertedOrder._id
      });
    } catch (error) {
      results.push({
        success: false,
        scheduledOrderId: order._id,
        error: error.message
      });
    }
  }
  
  return results;
};

scheduledOrderSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalScheduledOrders: { $sum: 1 },
        activeScheduledOrders: {
          $sum: { $cond: [{ $in: ['$status', ['scheduled', 'confirmed']] }, 1, 0] }
        },
        completedScheduledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelledScheduledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        averageParticipants: { $avg: { $size: '$participants' } },
        totalParticipants: { $sum: { $size: '$participants' } }
      }
    }
  ]);
  
  return stats[0] || {
    totalScheduledOrders: 0,
    activeScheduledOrders: 0,
    completedScheduledOrders: 0,
    cancelledScheduledOrders: 0,
    averageParticipants: 0,
    totalParticipants: 0
  };
};

module.exports = mongoose.model('ScheduledOrder', scheduledOrderSchema);
