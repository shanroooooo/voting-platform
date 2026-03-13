const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @route   POST /api/payments/create-payment-intent
// @desc    Create payment intent with Stripe
router.post('/create-payment-intent', authMiddleware, async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;

    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to pay for this order'
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalAmount * 100), // Convert to cents
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        orderId: orderId,
        userId: req.user.id
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      },
      message: 'Payment intent created successfully'
    });
  } catch (error) {
    logger.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/confirm-payment
// @desc    Confirm payment and update order status
router.post('/confirm-payment', authMiddleware, async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not successful'
      });
    }

    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order payment status
    order.paymentStatus = 'paid';
    order.paymentId = paymentIntentId;
    order.paidAt = new Date();
    
    // If order is still pending, move to confirmed
    if (order.status === 'pending') {
      order.status = 'confirmed';
      order.statusHistory.push({
        status: 'confirmed',
        timestamp: new Date(),
        updatedBy: 'system'
      });
    }

    await order.save();

    // Emit real-time payment confirmation
    const io = req.app.get('io');
    io.to(`order-${orderId}`).emit('payment-confirmed', {
      orderId,
      paymentIntentId,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: order,
      message: 'Payment confirmed successfully'
    });
  } catch (error) {
    logger.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/refund
// @desc    Process refund
router.post('/refund', authMiddleware, async (req, res) => {
  try {
    const { orderId, amount, reason } = req.body;

    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!order.paymentId) {
      return res.status(400).json({
        success: false,
        message: 'No payment found for this order'
      });
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: order.paymentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Convert to cents
      reason: 'requested_by_customer',
      metadata: {
        orderId,
        userId: req.user.id,
        reason
      }
    });

    // Update order
    order.paymentStatus = 'refunded';
    order.refundId = refund.id;
    order.refundAmount = refund.amount / 100;
    order.refundedAt = new Date();
    await order.save();

    res.json({
      success: true,
      data: refund,
      message: 'Refund processed successfully'
    });
  } catch (error) {
    logger.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/payment-methods
// @desc    Get user's saved payment methods
router.get('/payment-methods', authMiddleware, async (req, res) => {
  try {
    // In a real app, you would store payment methods in your database
    // For now, return empty array
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    logger.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/webhook
// @desc    Handle Stripe webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      logger.info('Payment succeeded:', paymentIntent.id);
      
      // Update order status
      await Order.findByIdAndUpdate(
        paymentIntent.metadata.orderId,
        {
          paymentStatus: 'paid',
          paymentId: paymentIntent.id,
          paidAt: new Date()
        }
      );
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      logger.info('Payment failed:', failedPayment.id);
      
      // Update order status
      await Order.findByIdAndUpdate(
        failedPayment.metadata.orderId,
        {
          paymentStatus: 'failed'
        }
      );
      break;

    case 'payment_intent.canceled':
      const canceledPayment = event.data.object;
      logger.info('Payment canceled:', canceledPayment.id);
      break;

    default:
      logger.info(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

// @route   GET /api/payments/:orderId
// @desc    Get payment details for an order
router.get('/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .select('paymentStatus paymentId totalAmount paidAt refundId refundAmount refundedAt');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (order.user && order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view payment details'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
